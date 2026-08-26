import type { OpenAPIV3 } from "openapi-types";

export const openApiDocument: OpenAPIV3.Document = {
  openapi: "3.0.3",
  info: {
    title: "Relay API",
    // OpenAPI requires this field even though Relay's URL contract is unversioned.
    version: "unversioned",
    description: "Backend API for the Relay meeting-to-task platform"
  },
  servers: [{ url: "/", description: "Current server" }],
  tags: [
    { name: "Foundation", description: "Service health and API metadata" },
    { name: "Authentication", description: "User identity and rotating refresh sessions" },
    { name: "Projects", description: "Project and membership management" },
    { name: "Kanban", description: "Project-specific workflow column configuration" },
    { name: "Tasks", description: "Project Kanban tasks and activity history" },
    { name: "Meetings", description: "Meeting transcripts and processing pipeline" }
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
    },
    schemas: {
      SignupInput: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string", minLength: 2, maxLength: 80 },
          email: { type: "string", format: "email" },
          password: { type: "string", format: "password", minLength: 12, maxLength: 72 }
        }
      },
      LoginInput: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", format: "password" }
        }
      },
      ProjectInput: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 2, maxLength: 100 },
          description: { type: "string", maxLength: 1_000 }
        }
      },
      ProjectUpdateInput: {
        type: "object",
        minProperties: 1,
        properties: {
          name: { type: "string", minLength: 2, maxLength: 100 },
          description: { type: "string", maxLength: 1_000 }
        }
      },
      InviteMemberInput: {
        type: "object",
        required: ["email"],
        properties: {
          email: { type: "string", format: "email" },
          role: { type: "string", enum: ["admin", "member"], default: "member" }
        }
      },
      KanbanColumnInput: {
        type: "object",
        required: ["name", "category"],
        properties: {
          name: { type: "string", minLength: 2, maxLength: 40 },
          color: { type: "string", pattern: "^#[A-Fa-f0-9]{6}$", default: "#64748B" },
          category: { type: "string", enum: ["todo", "in_progress", "done"] }
        }
      },
      KanbanColumnUpdateInput: {
        type: "object",
        minProperties: 1,
        properties: {
          name: { type: "string", minLength: 2, maxLength: 40 },
          color: { type: "string", pattern: "^#[A-Fa-f0-9]{6}$" },
          category: { type: "string", enum: ["todo", "in_progress", "done"] }
        }
      },
      KanbanColumnOrderInput: {
        type: "object",
        required: ["columnIds"],
        properties: {
          columnIds: {
            type: "array",
            minItems: 1,
            maxItems: 20,
            uniqueItems: true,
            items: { type: "string", format: "uuid" }
          }
        }
      },
      TaskInput: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string", minLength: 2, maxLength: 200 },
          description: { type: "string", maxLength: 5_000, nullable: true },
          assigneeId: { type: "string", pattern: "^[a-fA-F0-9]{24}$", nullable: true },
          dueDate: { type: "string", format: "date-time", nullable: true },
          priority: { type: "string", enum: ["low", "medium", "high"], default: "medium" },
          columnId: { type: "string", format: "uuid" }
        }
      },
      TaskUpdateInput: {
        type: "object",
        minProperties: 1,
        properties: {
          title: { type: "string", minLength: 2, maxLength: 200 },
          description: { type: "string", maxLength: 5_000, nullable: true },
          assigneeId: { type: "string", pattern: "^[a-fA-F0-9]{24}$", nullable: true },
          dueDate: { type: "string", format: "date-time", nullable: true },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          columnId: { type: "string", format: "uuid" }
        }
      },
      Error: {
        type: "object",
        required: ["success", "error"],
        properties: {
          success: { type: "boolean", enum: [false] },
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              fields: { type: "object", additionalProperties: { type: "string" } }
            }
          }
        }
      },
      MeetingInput: {
        type: "object",
        required: ["title", "transcript"],
        properties: {
          title: { type: "string", minLength: 2, maxLength: 200 },
          transcript: { type: "string", minLength: 1, maxLength: 500_000 }
        }
      },
      MeetingStatusInput: {
        type: "object",
        required: ["status"],
        properties: {
          status: { type: "string", enum: ["created", "processing", "ready_for_review", "completed", "failed"] }
        }
      }
    },
    parameters: {
      ProjectId: {
        name: "projectId",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" }
      },
      UserId: {
        name: "userId",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" }
      },
      TaskId: {
        name: "taskId",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" }
      },
      ColumnId: {
        name: "columnId",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" }
      },
      MeetingId: {
        name: "meetingId",
        in: "path",
        required: true,
        schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" }
      }
    }
  },
  paths: {
    "/health": {
      get: {
        tags: ["Foundation"],
        summary: "Check application and database health",
        responses: {
          "200": { description: "Application and database are healthy" },
          "503": { description: "Application is running but the database is unavailable" }
        }
      }
    },
    "/api": {
      get: {
        tags: ["Foundation"],
        summary: "Get API information",
        responses: { "200": { description: "API information" } }
      }
    },
    "/api/auth/signup": {
      post: {
        tags: ["Authentication"],
        summary: "Register and start a refresh session",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/SignupInput" } } }
        },
        responses: {
          "201": { description: "User created; refresh token set as an HTTP-only cookie" },
          "400": { description: "Invalid input" },
          "409": { description: "Email already registered" }
        }
      }
    },
    "/api/auth/login": {
      post: {
        tags: ["Authentication"],
        summary: "Authenticate and start a refresh session",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginInput" } } }
        },
        responses: { "200": { description: "Authenticated" }, "401": { description: "Invalid credentials" } }
      }
    },
    "/api/auth/refresh": {
      post: {
        tags: ["Authentication"],
        summary: "Rotate the refresh cookie and issue a new access token",
        responses: { "200": { description: "Session rotated" }, "401": { description: "Invalid session" } }
      }
    },
    "/api/auth/logout": {
      post: {
        tags: ["Authentication"],
        summary: "Revoke the current refresh session",
        responses: { "200": { description: "Session revoked or already absent" } }
      }
    },
    "/api/auth/me": {
      get: {
        tags: ["Authentication"],
        summary: "Get the current user",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Current public user" }, "401": { description: "Missing or invalid token" } }
      }
    },
    "/api/projects": {
      get: {
        tags: ["Projects"],
        summary: "List the current user's projects",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Authorized projects" } }
      },
      post: {
        tags: ["Projects"],
        summary: "Create a project and owner membership",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ProjectInput" } } }
        },
        responses: { "201": { description: "Project created" } }
      }
    },
    "/api/projects/{projectId}": {
      parameters: [{ $ref: "#/components/parameters/ProjectId" }],
      get: {
        tags: ["Projects"],
        summary: "Get an authorized project",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Project" }, "403": { description: "No membership" } }
      },
      patch: {
        tags: ["Projects"],
        summary: "Update a project as owner or admin",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ProjectUpdateInput" } } }
        },
        responses: { "200": { description: "Project updated" }, "403": { description: "Insufficient role" } }
      },
      delete: {
        tags: ["Projects"],
        summary: "Delete a project as owner",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Project deleted" }, "403": { description: "Owner role required" } }
      }
    },
    "/api/projects/{projectId}/members": {
      parameters: [{ $ref: "#/components/parameters/ProjectId" }],
      get: {
        tags: ["Projects"],
        summary: "List project members",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Project members" } }
      }
    },
    "/api/projects/{projectId}/members/invite": {
      parameters: [{ $ref: "#/components/parameters/ProjectId" }],
      post: {
        tags: ["Projects"],
        summary: "Add an existing Relay user by email",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/InviteMemberInput" } } }
        },
        responses: { "201": { description: "Member added" }, "409": { description: "Already a member" } }
      }
    },
    "/api/projects/{projectId}/members/{userId}": {
      parameters: [
        { $ref: "#/components/parameters/ProjectId" },
        { $ref: "#/components/parameters/UserId" }
      ],
      delete: {
        tags: ["Projects"],
        summary: "Remove a project member",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Member removed" }, "403": { description: "Role hierarchy denied removal" } }
      }
    },
    "/api/projects/{projectId}/kanban/columns": {
      parameters: [{ $ref: "#/components/parameters/ProjectId" }],
      get: {
        tags: ["Kanban"],
        summary: "List ordered project Kanban columns",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Project board definition" }, "403": { description: "No project membership" } }
      },
      post: {
        tags: ["Kanban"],
        summary: "Add a custom column as owner or admin",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/KanbanColumnInput" } } }
        },
        responses: { "201": { description: "Column created" }, "409": { description: "Duplicate name or 20-column limit" } }
      }
    },
    "/api/projects/{projectId}/kanban/columns/order": {
      parameters: [{ $ref: "#/components/parameters/ProjectId" }],
      put: {
        tags: ["Kanban"],
        summary: "Replace the complete column order as owner or admin",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/KanbanColumnOrderInput" } } }
        },
        responses: { "200": { description: "Columns reordered" }, "400": { description: "Incomplete or duplicate order" } }
      }
    },
    "/api/projects/{projectId}/kanban/columns/{columnId}": {
      parameters: [
        { $ref: "#/components/parameters/ProjectId" },
        { $ref: "#/components/parameters/ColumnId" }
      ],
      patch: {
        tags: ["Kanban"],
        summary: "Rename, recolor, or recategorize a column",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/KanbanColumnUpdateInput" } } }
        },
        responses: { "200": { description: "Column updated" }, "409": { description: "Final Todo category or duplicate name" } }
      },
      delete: {
        tags: ["Kanban"],
        summary: "Delete a column and optionally move its tasks",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "moveTasksToColumnId", in: "query", schema: { type: "string", format: "uuid" } }
        ],
        responses: { "200": { description: "Column deleted" }, "409": { description: "Destination required or final Todo column" } }
      }
    },
    "/api/projects/{projectId}/overview": {
      parameters: [{ $ref: "#/components/parameters/ProjectId" }],
      get: {
        tags: ["Projects"],
        summary: "Get project dashboard overview aggregation",
        description: "Returns task counts by column and category, overdue count, member count, and recent activity.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Project overview" },
          "403": { description: "No project membership" }
        }
      }
    },
    "/api/projects/{projectId}/tasks": {
      parameters: [{ $ref: "#/components/parameters/ProjectId" }],
      get: {
        tags: ["Tasks"],
        summary: "List or group authorized project tasks",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "columnId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "assignee", in: "query", schema: { type: "string", pattern: "^[a-fA-F0-9]{24}$" } },
          { name: "priority", in: "query", schema: { type: "string", enum: ["low", "medium", "high"] } },
          { name: "dueAfter", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "dueBefore", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "q", in: "query", schema: { type: "string", maxLength: 100 } },
          { name: "groupBy", in: "query", schema: { type: "string", enum: ["column"] } }
        ],
        responses: { "200": { description: "Filtered tasks or Kanban columns" }, "403": { description: "No project membership" } }
      },
      post: {
        tags: ["Tasks"],
        summary: "Create a project task",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/TaskInput" } } }
        },
        responses: { "201": { description: "Task and created activity recorded" }, "400": { description: "Invalid task or assignee" } }
      }
    },
    "/api/projects/{projectId}/tasks/{taskId}": {
      parameters: [
        { $ref: "#/components/parameters/ProjectId" },
        { $ref: "#/components/parameters/TaskId" }
      ],
      get: {
        tags: ["Tasks"],
        summary: "Get one authorized project task",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Task" }, "404": { description: "Task not found in this project" } }
      },
      patch: {
        tags: ["Tasks"],
        summary: "Update a task and record relevant activity",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/TaskUpdateInput" } } }
        },
        responses: { "200": { description: "Task updated" }, "400": { description: "Invalid task or assignee" } }
      },
      delete: {
        tags: ["Tasks"],
        summary: "Delete a task as owner or admin",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Task deleted" }, "403": { description: "Owner or admin role required" } }
      }
    },
    "/api/projects/{projectId}/tasks/{taskId}/activity": {
      parameters: [
        { $ref: "#/components/parameters/ProjectId" },
        { $ref: "#/components/parameters/TaskId" }
      ],
      get: {
        tags: ["Tasks"],
        summary: "List a task's activity history",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Chronological task activity" }, "404": { description: "Task not found in this project" } }
      }
    },
    "/api/projects/{projectId}/meetings": {
      parameters: [{ $ref: "#/components/parameters/ProjectId" }],
      get: {
        tags: ["Meetings"],
        summary: "List project meetings",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["created", "processing", "ready_for_review", "completed", "failed"] } }
        ],
        responses: { "200": { description: "Project meetings" }, "403": { description: "No project membership" } }
      },
      post: {
        tags: ["Meetings"],
        summary: "Create a meeting from pasted transcript",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/MeetingInput" } } }
        },
        responses: { "201": { description: "Meeting created with parsed segments" }, "400": { description: "Invalid input or unparseable transcript" } }
      }
    },
    "/api/projects/{projectId}/meetings/{meetingId}": {
      parameters: [
        { $ref: "#/components/parameters/ProjectId" },
        { $ref: "#/components/parameters/MeetingId" }
      ],
      get: {
        tags: ["Meetings"],
        summary: "Get a meeting",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Meeting detail" }, "404": { description: "Meeting not found" } }
      }
    },
    "/api/projects/{projectId}/meetings/{meetingId}/transcript": {
      parameters: [
        { $ref: "#/components/parameters/ProjectId" },
        { $ref: "#/components/parameters/MeetingId" }
      ],
      get: {
        tags: ["Meetings"],
        summary: "Get meeting transcript segments",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Ordered transcript segments" }, "404": { description: "Meeting not found" } }
      }
    },
    "/api/projects/{projectId}/meetings/{meetingId}/tasks": {
      parameters: [
        { $ref: "#/components/parameters/ProjectId" },
        { $ref: "#/components/parameters/MeetingId" }
      ],
      get: {
        tags: ["Meetings"],
        summary: "Get tasks sourced from a meeting",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Tasks traced to this meeting" }, "404": { description: "Meeting not found" } }
      }
    },
    "/api/projects/{projectId}/meetings/{meetingId}/status": {
      parameters: [
        { $ref: "#/components/parameters/ProjectId" },
        { $ref: "#/components/parameters/MeetingId" }
      ],
      patch: {
        tags: ["Meetings"],
        summary: "Advance meeting status",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/MeetingStatusInput" } } }
        },
        responses: { "200": { description: "Status updated" }, "409": { description: "Invalid status transition" } }
      }
    },
    "/api/projects/{projectId}/meetings/{meetingId}/reprocess": {
      parameters: [
        { $ref: "#/components/parameters/ProjectId" },
        { $ref: "#/components/parameters/MeetingId" }
      ],
      post: {
        tags: ["Meetings"],
        summary: "Reprocess a failed meeting",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "Meeting reset to created" }, "409": { description: "Meeting is not in failed status" } }
      }
    }
  }
};
