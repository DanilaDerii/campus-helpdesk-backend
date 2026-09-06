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
    tickets ||--o{ ticket_history : records
    users o|--o{ ticket_history : changes
    tickets ||--o{ email_notifications : generates

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
    ticket_history {
        int id PK
        int ticket_id FK
        int changed_by FK "nullable"
        string action
        string old_value
        string new_value
        datetime created_at
    }
    email_notifications {
        int id PK
        int ticket_id FK
        string recipient_email
        string notification_type
        DeliveryStatus delivery_status
        string provider_message_id "nullable"
        string error_message "nullable"
        int attempt_count
        datetime next_attempt_at "nullable"
        datetime created_at
        datetime sent_at "nullable"
    }
```
