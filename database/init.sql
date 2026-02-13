-- ============================================================================
-- Construction Management Platform - Database Initialization
-- ============================================================================
-- Creates all 9 tables, extensions, indexes, and triggers.
-- Tables are created in foreign-key dependency order.
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- Organizations table
-- ============================================================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(50) NOT NULL UNIQUE,
  logo_url VARCHAR(500),
  logo_thumbnail_url VARCHAR(500),
  primary_color VARCHAR(7),
  storage_used_bytes BIGINT DEFAULT 0,
  storage_limit_bytes BIGINT DEFAULT 10737418240,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_organizations_subdomain ON organizations(subdomain);

-- ============================================================================
-- Users table
-- ============================================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin', 'org_admin', 'project_manager', 'field_user')),
  is_active BOOLEAN DEFAULT true,
  failed_login_attempts INT DEFAULT 0,
  locked_until TIMESTAMP WITH TIME ZONE,
  last_login_at TIMESTAMP WITH TIME ZONE,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_org_email ON users(organization_id, email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);

-- ============================================================================
-- Projects table
-- ============================================================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  address TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  start_date DATE,
  target_completion_date DATE,
  image_url VARCHAR(500),
  thumbnail_url VARCHAR(500),
  responsible_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_projects_org_status ON projects(organization_id, status);
CREATE INDEX idx_projects_dates ON projects(start_date, target_completion_date);
CREATE INDEX idx_projects_responsible ON projects(responsible_user_id);

-- ============================================================================
-- Blueprints table
-- ============================================================================
CREATE TABLE blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type VARCHAR(50) NOT NULL,
  thumbnail_url VARCHAR(500),
  width_pixels INT,
  height_pixels INT,
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_blueprints_project ON blueprints(project_id);

-- ============================================================================
-- Tasks table
-- ============================================================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_number INTEGER NOT NULL,
  blueprint_id UUID REFERENCES blueprints(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'verified')),
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  trade VARCHAR(50),
  location_x FLOAT,
  location_y FLOAT,
  assigned_to_user UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_to_contractor_email VARCHAR(255),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  verified_at TIMESTAMP WITH TIME ZONE,
  annotation_x FLOAT,
  annotation_y FLOAT,
  annotation_width FLOAT,
  annotation_height FLOAT,
  annotation_page INTEGER,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  UNIQUE(project_id, task_number)
);

CREATE INDEX idx_tasks_project_status ON tasks(project_id, status);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to_user, status);
CREATE INDEX idx_tasks_contractor ON tasks(assigned_to_contractor_email);
CREATE INDEX idx_tasks_trade ON tasks(trade, status);
CREATE INDEX idx_tasks_search ON tasks USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- ============================================================================
-- Task photos table
-- ============================================================================
CREATE TABLE task_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_url VARCHAR(500) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  thumbnail_url VARCHAR(500),
  caption VARCHAR(500),
  uploaded_by UUID REFERENCES users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_task_photos_task ON task_photos(task_id);

-- ============================================================================
-- Task comments table
-- ============================================================================
CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  external_email VARCHAR(255),
  comment_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_task_comments_task ON task_comments(task_id, created_at);

-- ============================================================================
-- Protocols table (generated reports)
-- ============================================================================
CREATE TABLE protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  filters JSONB,
  file_url VARCHAR(500),
  file_size_bytes BIGINT,
  status VARCHAR(20) DEFAULT 'generating' CHECK (status IN ('generating', 'completed', 'failed')),
  generated_by UUID REFERENCES users(id),
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_protocols_project ON protocols(project_id, generated_at);

-- ============================================================================
-- Audit log table
-- ============================================================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  metadata JSONB,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_log_org_time ON audit_log(organization_id, created_at);
CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at);

-- ============================================================================
-- Password reset tokens table
-- ============================================================================
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX idx_reset_tokens_expiry ON password_reset_tokens(expires_at);

-- ============================================================================
-- Products table (organization-scoped product catalog)
-- ============================================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image_url VARCHAR(500),
  thumbnail_url VARCHAR(500),
  link VARCHAR(500),
  comment TEXT,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_products_org ON products(organization_id);
CREATE INDEX idx_products_org_product_id ON products(organization_id, product_id);

-- ============================================================================
-- Task products junction table (many-to-many: tasks <-> products)
-- ============================================================================
CREATE TABLE task_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(task_id, product_id)
);

CREATE INDEX idx_task_products_task ON task_products(task_id);
CREATE INDEX idx_task_products_product ON task_products(product_id);

-- ============================================================================
-- Custom field definitions table (organization-scoped form builder)
-- ============================================================================
CREATE TABLE custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('project', 'task', 'product', 'user')),
  field_key VARCHAR(100) NOT NULL,
  label VARCHAR(255) NOT NULL,
  field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'textarea', 'checkbox')),
  options JSONB,
  is_required BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, entity_type, field_key)
);

CREATE INDEX idx_cfd_org_entity_active ON custom_field_definitions(organization_id, entity_type, is_active);

-- ============================================================================
-- Project notes table
-- ============================================================================
CREATE TABLE project_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_project_notes_project ON project_notes(project_id);

-- ============================================================================
-- Trigger function to automatically update the updated_at column
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_field_definitions_updated_at
  BEFORE UPDATE ON custom_field_definitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_notes_updated_at
  BEFORE UPDATE ON project_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
