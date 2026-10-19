## Button Editor

This connection serves a compact outline editor for your buttons. Open it at `/instance/<connection label>/`
on your Companion web address, e.g. `http://127.0.0.1:8000/instance/button_editor/`. The connection's status
shows the exact address.

Each action or feedback is one line, with nested `if` / `else` blocks and groups indented below it. Click a
line to edit it, drag it by its handle to move it, or add new ones from a searchable list.

**Edits are live.** Every change is applied to the button in Companion immediately, exactly as if it was made
in Companion's own editor. There is no separate save step and no undo, so take care with buttons in use.

If Companion's admin password lockout is enabled, the editor asks for that password too, and locks again
after the same idle time. As in Companion, this prevents accidental changes; it is not a security feature, so
anyone who can reach Companion's web address can control it.

This connection has no actions, feedbacks or variables of its own.
