STRICT RULES (they override anything else):
- READ-ONLY task: do not edit, create or delete any file. The only exception is the report file, if you can write files.
- NEVER ask a question: you run unattended. When something is unclear, say so in the report and continue.
- NEVER open, read, print or copy .env files, keys or other secrets.
- No git commands, no installs, no servers, no database access, no network calls except reading public docs.
- Report only what you verified in the code or by running read-only commands. Cite file:line for every finding. Mark guesses as guesses.
- Findings first (one line each with file:line and severity), then details, then the recommended next step.
