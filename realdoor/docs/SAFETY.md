# Safety and decision boundaries

RealDoor is an application-readiness tool, not an eligibility system.

- It may extract facts, link evidence, retrieve supplied rules, show formulas, identify missing document types, and assemble packets.
- It may not conclude eligibility, approve or deny an applicant, rank households, assign priority, or replace a qualified reviewer.
- A completeness score describes only whether expected document types are present.
- The rules assistant never falls back to general model knowledge.
- When the corpus does not support a response, the application says: “I cannot answer because this information is not available in the provided rule documents.”
- Text inside uploaded documents is treated as untrusted evidence, never as system instructions.

