from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class BaseSchema(BaseModel):
    """Project-wide Pydantic base.

    snake_case in Python; camelCase on the API wire. `populate_by_name`
    lets us accept either casing on input. `from_attributes` enables
    ORM-style construction (`Schema.model_validate(orm_obj)`).
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class ErrorDetail(BaseSchema):
    code: str
    message: str
    request_id: str | None = None


class ErrorResponse(BaseSchema):
    error: ErrorDetail
