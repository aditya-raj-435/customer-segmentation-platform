# Customer Segmentation Analytics Platform

A machine learning-powered customer segmentation platform that helps businesses understand and categorize their customer base using advanced clustering techniques.

## Features

- **Automated Customer Segmentation**: Uses K-means clustering with optimal cluster selection
- **Rich Feature Engineering**: Creates meaningful customer metrics and scores
- **Interactive Web Interface**: Upload data and view segmentation results
- **Real-time Analysis**: Process customer data and get instant insights
- **Detailed Analytics**: View comprehensive segment profiles and statistics
- **API Endpoints**: RESTful API for integration with other systems

## Technology Stack

- **Backend**: FastAPI, Python 3.8+
- **Machine Learning**: scikit-learn, pandas, numpy
- **Frontend**: HTML5, CSS3, JavaScript
- **Data Storage**: File-based CSV storage
- **Development Server**: Uvicorn

## Project Structure

```
.
├── app/
│   ├── main.py              # FastAPI application
│   ├── models/
│   │   ├── segmentation.py  # Segmentation model
│   │   └── schemas.py       # Data models
│   └── static/
│       ├── css/
│       ├── js/
│       └── index.html
├── data/                    # Data storage
├── models/                  # Saved ML models
├── requirements.txt
└── README.md
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/customer-segmentation-platform.git
cd customer-segmentation-platform
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

## Usage

1. Start the server:
```bash
python -m uvicorn app.main:app --reload
```

2. Access the web interface:
- Open your browser and navigate to `http://localhost:8000`
- Upload your customer data CSV file
- View the segmentation results and insights

## API Documentation

Access the API documentation at `http://localhost:8000/docs` when the server is running.

### Key Endpoints

- `POST /upload-data/`: Upload customer data CSV
- `GET /data-summary/`: Get summary statistics of uploaded data
- `POST /segment-customers/`: Perform customer segmentation
- `POST /predict-segment/`: Predict segment for new customer
- `GET /segment-analysis/`: Get detailed segment analysis

## Data Format

The input CSV should contain the following columns:

- `age`: Customer age
- `income`: Annual income
- `visits_per_month`: Average monthly visits
- `avg_time_spent`: Average time spent per visit
- `purchase_frequency`: Number of purchases per month
- `avg_order_value`: Average order value
- `customer_lifetime_value`: Total customer value
- `gender`: Customer gender
- `preferred_category`: Preferred product category

## Model Features

### Engineered Features

- **Engagement Score**: Composite score based on visits, time spent, and purchase frequency
- **Value Score**: Weighted combination of order value and lifetime value
- **Average Value per Visit**: Customer lifetime value normalized by visit frequency

### Segmentation Insights

- Value Level (high-value, mid-tier, budget-conscious)
- Purchase Frequency (frequent, regular, infrequent)
- Engagement Level (highly engaged, moderate, low engagement)
- Gender Distribution
- Category Preferences
- Detailed Segment Metrics

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- scikit-learn for machine learning tools
- FastAPI for the web framework
- pandas and numpy for data processing 