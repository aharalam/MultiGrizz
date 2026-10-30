# API contracts

Shared interface between the frontend and backend. Agree here on endpoint paths, request/response shapes, error shapes, and Realtime event payloads before implementing both sides.

The frontend must not import backend implementation files, and the backend must not import frontend files. Each side owns its dependencies and build. Prefer JSON/OpenAPI contracts or documented examples initially. No API schema has been agreed yet.

Both pairs coordinate edits here. Namespace room and event access by party and player team, and document authentication requirements. Never include real credentials or private team content in examples.
