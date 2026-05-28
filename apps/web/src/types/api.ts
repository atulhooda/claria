/**
 * Single integration point for API DTOs.
 *
 * Today these are hand-rolled mirrors of the FastAPI Pydantic schemas.
 * Once `packages/shared-types` generates types from the OpenAPI spec,
 * this file collapses to a one-line re-export and every consumer keeps
 * working without changes.
 */

export interface HealthResponse {
  status: string;
  env: string;
  version: string;
}
