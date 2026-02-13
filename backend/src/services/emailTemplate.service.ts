import Handlebars from 'handlebars';

// ────────────────────────────────────────────────────────────────
// Task Assignment
// ────────────────────────────────────────────────────────────────
const taskAssignmentHtml = Handlebars.compile(`
<!DOCTYPE html>
<html>
<head><style>body{font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto}
.header{background:#2563eb;color:#fff;padding:20px;text-align:center}
.content{padding:20px}.btn{display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;
text-decoration:none;border-radius:4px;margin-top:10px}
.footer{padding:20px;font-size:12px;color:#666;border-top:1px solid #eee}</style></head>
<body>
<div class="header"><h2>Task Assignment</h2></div>
<div class="content">
<p>Hello,</p>
<p>You have been assigned a new task in the project <strong>{{projectName}}</strong>:</p>
<ul>
<li><strong>Task:</strong> {{taskTitle}}</li>
<li><strong>Priority:</strong> {{priority}}</li>
<li><strong>Trade:</strong> {{trade}}</li>
</ul>
{{#if description}}<p><strong>Description:</strong> {{description}}</p>{{/if}}
<p>Assigned by: {{assignedBy}}</p>
</div>
<div class="footer"><p>TaskProof</p></div>
</body></html>
`);

const taskAssignmentText = Handlebars.compile(`Task Assignment

Hello,

You have been assigned a new task in the project "{{projectName}}":

- Task: {{taskTitle}}
- Priority: {{priority}}
- Trade: {{trade}}
{{#if description}}
Description: {{description}}
{{/if}}

Assigned by: {{assignedBy}}
`);

// ────────────────────────────────────────────────────────────────
// Password Reset
// ────────────────────────────────────────────────────────────────
const passwordResetHtml = Handlebars.compile(`
<!DOCTYPE html>
<html>
<head><style>body{font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto}
.header{background:#2563eb;color:#fff;padding:20px;text-align:center}
.content{padding:20px}.btn{display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;
text-decoration:none;border-radius:4px;margin-top:10px}
.footer{padding:20px;font-size:12px;color:#666;border-top:1px solid #eee}</style></head>
<body>
<div class="header"><h2>Password Reset</h2></div>
<div class="content">
<p>Hello {{firstName}},</p>
<p>We received a request to reset your password. Use the link below to set a new password:</p>
<p><a href="{{resetUrl}}" class="btn">Reset Password</a></p>
<p>This link expires in 1 hour.</p>
<p>If you did not request this, please ignore this email.</p>
</div>
<div class="footer"><p>TaskProof</p></div>
</body></html>
`);

const passwordResetText = Handlebars.compile(`Password Reset

Hello {{firstName}},

We received a request to reset your password. Use the link below to set a new password:

{{resetUrl}}

This link expires in 1 hour. If you did not request this, please ignore this email.
`);

// ────────────────────────────────────────────────────────────────
// User Invitation
// ────────────────────────────────────────────────────────────────
const userInvitationHtml = Handlebars.compile(`
<!DOCTYPE html>
<html>
<head><style>body{font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto}
.header{background:#2563eb;color:#fff;padding:20px;text-align:center}
.content{padding:20px}.btn{display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;
text-decoration:none;border-radius:4px;margin-top:10px}
.footer{padding:20px;font-size:12px;color:#666;border-top:1px solid #eee}</style></head>
<body>
<div class="header"><h2>You've Been Invited</h2></div>
<div class="content">
<p>Hello {{firstName}},</p>
<p>You have been invited to join <strong>{{organizationName}}</strong> on the TaskProof.</p>
<p>Your role: <strong>{{role}}</strong></p>
<p>A temporary password has been set for your account. Please log in and change it immediately.</p>
<p><a href="{{loginUrl}}" class="btn">Log In</a></p>
</div>
<div class="footer"><p>TaskProof</p></div>
</body></html>
`);

const userInvitationText = Handlebars.compile(`You've Been Invited

Hello {{firstName}},

You have been invited to join "{{organizationName}}" on the TaskProof.

Your role: {{role}}

A temporary password has been set for your account. Please log in and change it immediately.

Log in at: {{loginUrl}}
`);

// ────────────────────────────────────────────────────────────────
// Task Completed
// ────────────────────────────────────────────────────────────────
const taskCompletedHtml = Handlebars.compile(`
<!DOCTYPE html>
<html>
<head><style>body{font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto}
.header{background:#16a34a;color:#fff;padding:20px;text-align:center}
.content{padding:20px}
.footer{padding:20px;font-size:12px;color:#666;border-top:1px solid #eee}</style></head>
<body>
<div class="header"><h2>Task Completed</h2></div>
<div class="content">
<p>Hello {{firstName}},</p>
<p>A task in project <strong>{{projectName}}</strong> has been marked as completed:</p>
<ul>
<li><strong>Task:</strong> {{taskTitle}}</li>
<li><strong>Completed by:</strong> {{completedBy}}</li>
</ul>
<p>Please review and verify this task.</p>
</div>
<div class="footer"><p>TaskProof</p></div>
</body></html>
`);

const taskCompletedText = Handlebars.compile(`Task Completed

Hello {{firstName}},

A task in project "{{projectName}}" has been marked as completed:

- Task: {{taskTitle}}
- Completed by: {{completedBy}}

Please review and verify this task.
`);

// ────────────────────────────────────────────────────────────────
// Protocol Signing
// ────────────────────────────────────────────────────────────────
const protocolSigningHtml = Handlebars.compile(`
<!DOCTYPE html>
<html>
<head><style>body{font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto}
.header{background:#2563eb;color:#fff;padding:20px;text-align:center}
.content{padding:20px}.btn{display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;
text-decoration:none;border-radius:4px;margin-top:10px}
.footer{padding:20px;font-size:12px;color:#666;border-top:1px solid #eee}</style></head>
<body>
<div class="header"><h2>Protocol Signing Request</h2></div>
<div class="content">
<p>Hello,</p>
<p>You have been asked to sign the protocol <strong>{{protocolName}}</strong>.</p>
<p>Please review the protocol and provide your signature using the link below:</p>
<p><a href="{{signingUrl}}" class="btn">Sign Protocol</a></p>
<p>This link expires in 7 days.</p>
</div>
<div class="footer"><p>TaskProof</p></div>
</body></html>
`);

const protocolSigningText = Handlebars.compile(`Protocol Signing Request

Hello,

You have been asked to sign the protocol "{{protocolName}}".

Please review the protocol and provide your signature using the link below:

{{signingUrl}}

This link expires in 7 days.
`);

// ────────────────────────────────────────────────────────────────
// Render functions
// ────────────────────────────────────────────────────────────────

export interface TaskAssignmentData {
  projectName: string;
  taskTitle: string;
  priority: string;
  trade: string;
  description?: string;
  assignedBy: string;
}

export interface PasswordResetData {
  firstName: string;
  resetUrl: string;
}

export interface UserInvitationData {
  firstName: string;
  organizationName: string;
  role: string;
  loginUrl: string;
}

export interface TaskCompletedData {
  firstName: string;
  projectName: string;
  taskTitle: string;
  completedBy: string;
}

export function renderTaskAssignment(data: TaskAssignmentData) {
  return {
    subject: `Task assigned: ${data.taskTitle}`,
    html: taskAssignmentHtml(data),
    text: taskAssignmentText(data),
  };
}

export function renderPasswordReset(data: PasswordResetData) {
  return {
    subject: 'Password Reset Request',
    html: passwordResetHtml(data),
    text: passwordResetText(data),
  };
}

export function renderUserInvitation(data: UserInvitationData) {
  return {
    subject: `You've been invited to ${data.organizationName}`,
    html: userInvitationHtml(data),
    text: userInvitationText(data),
  };
}

export function renderTaskCompleted(data: TaskCompletedData) {
  return {
    subject: `Task completed: ${data.taskTitle}`,
    html: taskCompletedHtml(data),
    text: taskCompletedText(data),
  };
}

export interface ProtocolSigningData {
  protocolName: string;
  signingUrl: string;
}

export function renderProtocolSigning(data: ProtocolSigningData) {
  return {
    subject: `Protocol signing request: ${data.protocolName}`,
    html: protocolSigningHtml(data),
    text: protocolSigningText(data),
  };
}
