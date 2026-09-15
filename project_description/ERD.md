# Campus HelpDesk database ERD

Current schema after the pending migrations. Types and constraints are defined in
[schema.prisma](../prisma/schema.prisma). The Mermaid source below has not been rendered.

```mermaid
erDiagram
    users ||--o{ tickets : requests
    users o|--o{ tickets : assigned_to
    ticket_categories ||--o{ tickets : categorizes
    tickets ||--o{ ticket_comments : contains
    users ||--o{ ticket_comments : authors

    users {
        int id PK
        string microsoft_oid UK
        string email UK
        string display_name
        Role role
        boolean is_active
        datetime created_at
        datetime updated_at
    }
    ticket_categories {
        int id PK
        string name UK
        string description
    }
    tickets {
        int id PK
        int requester_id FK
        int assigned_technician_id FK "nullable"
        int category_id FK
        string title
        string description
        string location
        TicketStatus status
        TicketPriority priority
        datetime created_at
        datetime updated_at
        datetime resolved_at "nullable"
    }
    ticket_comments {
        int id PK
        int ticket_id FK
        int author_id FK
        string message
        datetime created_at
    }
```
