from typing import Dict, Optional
from pydantic import BaseModel, Field

class CustomerData(BaseModel):
    age: int = Field(..., ge=0, le=120, description="Customer age in years")
    gender: str = Field(..., pattern="^[MFO]$", description="Customer gender (M/F/O)")
    income: float = Field(..., ge=0, description="Annual income")
    purchase_frequency: Optional[float] = Field(None, ge=0, description="Number of purchases per year")
    last_purchase: Optional[int] = Field(None, ge=0, description="Days since last purchase")

class SegmentResponse(BaseModel):
    segment_id: int
    segment_label: str
    customer_data: Dict
    segment_characteristics: Dict 