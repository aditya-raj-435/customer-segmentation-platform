from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
import pandas as pd
import numpy as np
from typing import Dict, Tuple
import joblib
from pathlib import Path

class CustomerSegmentation:
    def __init__(self):
        self.scaler = StandardScaler()
        self.label_encoders = {}
        self.model = None
        self.model_dir = Path("models")
        self.model_dir.mkdir(exist_ok=True)
        
        # Segment description templates based on feature analysis
        self.segment_descriptions = {}  # Will be set after clustering
        
        # Features to use for segmentation
        self.numeric_features = [
            'age', 'income', 'visits_per_month', 'avg_time_spent',
            'purchase_frequency', 'avg_order_value', 'customer_lifetime_value'
        ]
        self.categorical_features = ['gender', 'preferred_category']
    
    def _encode_categorical(self, df: pd.DataFrame) -> pd.DataFrame:
        """Encode categorical variables."""
        df_encoded = df.copy()
        
        for feature in self.categorical_features:
            if feature in df.columns:
                le = LabelEncoder()
                df_encoded[feature] = le.fit_transform(df_encoded[feature].astype(str))
                self.label_encoders[feature] = le
                
        return df_encoded
    
    def _engineer_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create new features from existing ones."""
        df_engineered = df.copy()
        
        # Average value per visit
        df_engineered['avg_value_per_visit'] = (df_engineered['customer_lifetime_value'] / 
                                               (df_engineered['visits_per_month'] + 1))  # Add 1 to avoid division by zero
        
        # Engagement score
        df_engineered['engagement_score'] = (df_engineered['visits_per_month'] * 0.3 + 
                                           df_engineered['avg_time_spent'] * 0.3 +
                                           df_engineered['purchase_frequency'] * 0.4)
        
        # Value score
        df_engineered['value_score'] = (df_engineered['avg_order_value'] * 0.4 +
                                       df_engineered['customer_lifetime_value'] * 0.6)
        
        return df_engineered
    
    def _determine_optimal_clusters(self, X: np.ndarray, max_clusters: int = 8) -> int:
        """Determine optimal number of clusters using silhouette score."""
        best_score = -1
        best_n_clusters = 4  # Default
        
        for n_clusters in range(3, max_clusters + 1):
            kmeans = KMeans(n_clusters=n_clusters, n_init=10, random_state=42)
            cluster_labels = kmeans.fit_predict(X)
            silhouette_avg = silhouette_score(X, cluster_labels)
            
            if silhouette_avg > best_score:
                best_score = silhouette_avg
                best_n_clusters = n_clusters
        
        return best_n_clusters
    
    def _generate_segment_descriptions(self, df: pd.DataFrame, df_engineered: pd.DataFrame) -> Dict:
        """Generate detailed segment descriptions based on cluster characteristics."""
        descriptions = {}
        
        for segment in df['segment'].unique():
            segment_data = df[df['segment'] == segment]
            segment_data_eng = df_engineered[df['segment'] == segment]
            
            # Calculate key metrics
            avg_value = segment_data['customer_lifetime_value'].mean()
            avg_frequency = segment_data['purchase_frequency'].mean()
            avg_engagement = segment_data_eng['engagement_score'].mean()
            
            # Determine segment characteristics
            if avg_value > df['customer_lifetime_value'].mean() * 1.2:
                value_level = "high-value"
            elif avg_value < df['customer_lifetime_value'].mean() * 0.8:
                value_level = "budget-conscious"
            else:
                value_level = "mid-tier"
                
            if avg_frequency > df['purchase_frequency'].mean() * 1.2:
                frequency_level = "frequent"
            elif avg_frequency < df['purchase_frequency'].mean() * 0.8:
                frequency_level = "infrequent"
            else:
                frequency_level = "regular"
                
            if avg_engagement > df_engineered['engagement_score'].mean() * 1.2:
                engagement_level = "highly engaged"
            elif avg_engagement < df_engineered['engagement_score'].mean() * 0.8:
                engagement_level = "low engagement"
            else:
                engagement_level = "moderately engaged"
            
            # Generate description
            descriptions[segment] = f"{value_level.title()}, {frequency_level} purchasers with {engagement_level}"
            
        return descriptions
    
    def preprocess_data(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """Preprocess data for clustering."""
        df_processed = df.copy()
        
        # Handle missing values
        for col in self.numeric_features:
            if df_processed[col].isnull().any():
                df_processed[col] = df_processed[col].fillna(df_processed[col].median())
        
        # Encode categorical variables
        df_processed = self._encode_categorical(df_processed)
        
        # Engineer features
        df_engineered = self._engineer_features(df_processed)
        
        # Select features for clustering
        features_for_clustering = (self.numeric_features + 
                                 self.categorical_features + 
                                 ['avg_value_per_visit', 'engagement_score', 'value_score'])
        
        # Scale the features
        df_engineered[features_for_clustering] = self.scaler.fit_transform(
            df_engineered[features_for_clustering]
        )
        
        return df_engineered[features_for_clustering], df_engineered
    
    def segment_customers(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict]:
        """Segment customers and generate insights."""
        try:
            # Preprocess data
            df_processed, df_engineered = self.preprocess_data(df)
            
            # Determine optimal number of clusters
            n_clusters = self._determine_optimal_clusters(df_processed.values)
            
            # Initialize and fit the model with optimal clusters
            self.model = KMeans(n_clusters=n_clusters, n_init=10, random_state=42)
            clusters = self.model.fit_predict(df_processed)
            df['segment'] = clusters
            
            # Generate segment descriptions
            self.segment_descriptions = self._generate_segment_descriptions(df, df_engineered)
            
            # Generate insights
            insights = {
                'segment_sizes': df['segment'].value_counts().to_dict(),
                'segment_profiles': {},
                'model_info': {
                    'algorithm': 'kmeans',
                    'n_clusters': n_clusters,
                    'silhouette_score': float(silhouette_score(df_processed, clusters)),
                    'features_used': list(df_processed.columns)
                }
            }
            
            # Calculate segment profiles
            for segment in range(n_clusters):
                segment_data = df[df['segment'] == segment]
                segment_data_eng = df_engineered[df['segment'] == segment]
                
                insights['segment_profiles'][f'Segment_{segment}'] = {
                    'label': self.segment_descriptions[segment],
                    'size': len(segment_data),
                    'percentage': round(len(segment_data) / len(df) * 100, 2),
                    'avg_metrics': {
                        col: round(float(segment_data[col].mean()), 2)
                        for col in self.numeric_features
                    },
                    'engagement_metrics': {
                        'avg_engagement_score': round(float(segment_data_eng['engagement_score'].mean()), 2),
                        'avg_value_score': round(float(segment_data_eng['value_score'].mean()), 2)
                    },
                    'top_categories': segment_data['preferred_category'].value_counts().head(3).to_dict(),
                    'gender_distribution': segment_data['gender'].value_counts(normalize=True).to_dict()
                }
            
            # Save the model
            self._save_models()
            
            return df, insights
            
        except Exception as e:
            print(f"Error in segment_customers: {str(e)}")
            raise
    
    def predict_segment(self, customer_data: Dict) -> Tuple[int, str]:
        """Predict segment for a single customer."""
        try:
            # Create DataFrame with single customer
            df = pd.DataFrame([customer_data])
            
            # Preprocess the data
            df_processed, _ = self.preprocess_data(df)
            
            # Predict segment
            segment = int(self.model.predict(df_processed)[0])
            
            return segment, self.segment_descriptions[segment]
            
        except Exception as e:
            print(f"Error in predict_segment: {str(e)}")
            raise
    
    def _save_models(self):
        """Save models to disk."""
        try:
            joblib.dump(self.model, self.model_dir / 'kmeans_model.joblib')
            joblib.dump(self.scaler, self.model_dir / 'scaler.joblib')
            joblib.dump(self.label_encoders, self.model_dir / 'label_encoders.joblib')
        except Exception as e:
            print(f"Warning: Could not save models: {str(e)}")
    
    def _load_models(self):
        """Load models from disk."""
        try:
            self.model = joblib.load(self.model_dir / 'kmeans_model.joblib')
            self.scaler = joblib.load(self.model_dir / 'scaler.joblib')
            self.label_encoders = joblib.load(self.model_dir / 'label_encoders.joblib')
        except Exception as e:
            print(f"Warning: Could not load models: {str(e)}")
            raise ValueError("No trained model found. Please run segmentation first.") 