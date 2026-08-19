from __future__ import annotations

from pydantic import BaseModel, Field, model_validator


class NetworkRequest(BaseModel):
    network_id: str | None = Field(default=None, alias="networkId")
    inp_text: str | None = Field(default=None, alias="inpText")
    sample_time_seconds: float | None = Field(default=None, alias="sampleTimeSeconds")
    georeference_profile_id: str | None = Field(default=None, alias="georeferenceProfileId")

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def one_source(self) -> NetworkRequest:
        has_id = bool(self.network_id and self.network_id.strip())
        has_text = bool(self.inp_text and self.inp_text.strip())
        if has_id == has_text:
            raise ValueError("Provide exactly one of networkId or inpText.")
        return self
