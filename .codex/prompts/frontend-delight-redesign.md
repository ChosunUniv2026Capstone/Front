Read `../docs/03-conventions/conv-frontend-experience-design.md` first.

You are redesigning `Front` without changing current product behavior.

Rules:
- Keep existing API contracts, role boundaries, and backend-owned decisions.
- Treat login as the only expressive narrative surface.
- Treat the authenticated app as a calm operational workspace.
- Avoid dashboard-card mosaics, thick borders on every region, and decorative gradients behind routine product UI.
- Use explicit CSS tokens and meaningful spacing hierarchy.
- Prefer utility copy over marketing copy on product surfaces.
- Present eligibility as human-readable status first, raw reason code second, evidence last.
- Preserve desktop/mobile usability.
- Run `npm run test:unit`, `npm run lint`, `npm run build`, and screenshot-based verification before completion.
