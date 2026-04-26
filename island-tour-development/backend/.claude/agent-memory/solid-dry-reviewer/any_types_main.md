---
name: Any Types in main.ts Swagger Block
description: `any` casts in the Better Auth OpenAPI merge block in main.ts — tracked for future typing fix
type: project
---

`backend/src/main.ts` lines 90, 91, 98, 115 use `any` casts in the block that merges Better Auth's OpenAPI schema into the NestJS Swagger document.

The `any` casts exist because the Better Auth `generateOpenAPISchema()` return type and the NestJS `OpenAPIObject` type are not compatible without them. This is an acceptable pragmatic tradeoff given the schema merge is only active in non-production environments.

**How to apply:** If Better Auth or `@nestjs/swagger` adds proper typing for this merge, remove the casts. Do not escalate this to a critical issue in reviews — it is a known boundary-type problem.
