import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.templating import Jinja2Templates
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, Optional, List, Any
import json
import logging
import aiofiles

from app.models.segmentation import CustomerSegmentation
from app.models.schemas import CustomerData, SegmentResponse

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Customer Segmentation API",
    description="API for demographic customer segmentation in retail/e-commerce",
    version="1.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create necessary directories
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

# Mount static files and templates
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

# Initialize the segmentation model
segmentation = CustomerSegmentation()

@app.get("/")
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}

@app.post("/upload-data/")
async def upload_data(file: UploadFile):
    try:
        logger.info(f"Receiving file upload: {file.filename}")
        
        # Create data directory if it doesn't exist
        DATA_DIR.mkdir(exist_ok=True)
        file_path = DATA_DIR / "customer_data.csv"
        
        # Save uploaded file
        async with aiofiles.open(file_path, 'wb') as out_file:
            content = await file.read()
            await out_file.write(content)
        
        # Read and validate CSV
        df = pd.read_csv(file_path)
        logger.info(f"Successfully read CSV with shape: {df.shape}")
        
        # Verify required columns
        required_columns = [
            'age', 'income', 'visits_per_month', 'avg_time_spent',
            'purchase_frequency', 'avg_order_value', 'customer_lifetime_value',
            'gender', 'preferred_category'
        ]
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise ValueError(f"Missing required columns: {missing_columns}")
        
        return {"message": "File uploaded successfully", "shape": df.shape}
    except Exception as e:
        logger.error(f"Error in upload_data: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/data-summary/")
async def get_data_summary():
    try:
        file_path = DATA_DIR / "customer_data.csv"
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="No data file found. Please upload data first.")
        
        logger.info("Reading data file for summary")
        df = pd.read_csv(file_path)
        
        summary = {
            "total_customers": len(df),
            "columns": list(df.columns),
            "numeric_columns_summary": {
                col: {
                    "mean": float(df[col].mean()),
                    "median": float(df[col].median()),
                    "std": float(df[col].std()),
                    "min": float(df[col].min()),
                    "max": float(df[col].max()),
                    "quartiles": {
                        "25%": float(df[col].quantile(0.25)),
                        "75%": float(df[col].quantile(0.75))
                    }
                }
                for col in df.select_dtypes(include=[np.number]).columns
            },
            "categorical_columns_summary": {
                col: {
                    "value_counts": df[col].value_counts().to_dict(),
                    "unique_values": len(df[col].unique())
                }
                for col in df.select_dtypes(include=['object']).columns
            }
        }
        
        logger.info("Data summary generated successfully")
        return summary
    
    except Exception as e:
        logger.error(f"Error in get_data_summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/segment-customers/")
async def segment_customers():
    try:
        logger.info("Starting customer segmentation process")
        
        # Check if data file exists
        file_path = DATA_DIR / "customer_data.csv"
        if not file_path.exists():
            logger.error("No data file found")
            raise HTTPException(status_code=404, detail="No data file found. Please upload data first.")
        
        # Load data
        logger.info("Loading customer data")
        df = pd.read_csv(file_path)
        logger.info(f"Loaded data with shape: {df.shape}")
        
        # Perform segmentation
        logger.info("Starting segmentation analysis")
        df_segmented, insights = segmentation.segment_customers(df)
        logger.info(f"Segmentation completed. Found {len(insights['segment_sizes'])} segments")
        
        # Save segmented data
        try:
            df_segmented.to_csv(DATA_DIR / "segmented_customers.csv", index=False)
            logger.info("Saved segmented customer data")
        except Exception as e:
            logger.warning(f"Could not save segmented data: {str(e)}")
        
        # Convert numpy types to Python native types
        insights = json.loads(json.dumps(insights, default=lambda x: float(x) if isinstance(x, np.number) else x))
        
        # Add summary statistics
        insights['summary'] = {
            'total_customers': len(df),
            'segments_found': len(insights['segment_sizes']),
            'model_quality': {
                'silhouette_score': insights['model_info']['silhouette_score'],
                'features_used': len(insights['model_info']['features_used'])
            }
        }
        
        logger.info("Returning segmentation insights")
        return JSONResponse(content={"insights": insights})
    
    except Exception as e:
        logger.error(f"Error in segment_customers: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "error": str(e),
                "type": type(e).__name__,
                "detail": "Error occurred during segmentation process"
            }
        )

@app.post("/predict-segment/")
async def predict_segment(customer_data: Dict[str, Any]):
    try:
        logger.info("Starting segment prediction for single customer")
        logger.debug(f"Input customer data: {customer_data}")
        
        # Convert numpy types to Python native types
        customer_data = {k: float(v) if isinstance(v, (np.number, int, float)) else v 
                        for k, v in customer_data.items()}
        
        # Predict segment
        segment_id, segment_label = segmentation.predict_segment(customer_data)
        logger.info(f"Predicted segment {segment_id}: {segment_label}")
        
        # Get segment characteristics
        df = pd.read_csv(DATA_DIR / "customer_data.csv")
        df_segmented, insights = segmentation.segment_customers(df)
        segment_profile = insights['segment_profiles'][f'Segment_{segment_id}']
        
        response = {
            "segment": int(segment_id),
            "segment_label": segment_label,
            "customer_data": customer_data,
            "segment_characteristics": segment_profile
        }
        
        # Convert numpy types to Python native types
        response = json.loads(json.dumps(response, default=lambda x: float(x) if isinstance(x, np.number) else x))
        
        logger.info("Successfully generated prediction response")
        return response
    
    except Exception as e:
        logger.error(f"Error in predict_segment: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "error": str(e),
                "type": type(e).__name__,
                "detail": "Error occurred during segment prediction"
            }
        )

@app.get("/segment-analysis/")
async def get_segment_analysis():
    try:
        # Load data and perform segmentation
        df = pd.read_csv(DATA_DIR / "customer_data.csv")
        df_segmented, insights = segmentation.segment_customers(df)
        
        # Basic statistics for each segment
        analysis = {
            "total_customers": len(df),
            "number_of_segments": 4,
            "segment_statistics": {}
        }
        
        for segment in range(4):
            segment_data = df_segmented[df_segmented['segment'] == segment]
            
            # Calculate statistics for numeric columns
            numeric_stats = {}
            for col in segmentation.required_features:
                stats = {
                    "mean": float(segment_data[col].mean()),
                    "median": float(segment_data[col].median()),
                    "std": float(segment_data[col].std()),
                    "min": float(segment_data[col].min()),
                    "max": float(segment_data[col].max())
                }
                numeric_stats[col] = stats
            
            analysis["segment_statistics"][f"Segment_{segment}"] = {
                "size": len(segment_data),
                "percentage": float(len(segment_data) / len(df) * 100),
                "numeric_stats": numeric_stats
            }
        
        # Convert numpy types to Python native types
        analysis = json.loads(json.dumps(analysis, default=lambda x: float(x) if isinstance(x, np.number) else x))
        
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 