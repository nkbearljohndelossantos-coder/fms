-- NKB MANUFACTURING CORP. - FORMULATION MANAGER SYSTEM
-- Database SQL Dump for phpMyAdmin
-- Database: u335953510_fms_db

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- --------------------------------------------------------
-- Table structure for `users`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(255) NOT NULL UNIQUE,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `first_name` VARCHAR(255) NOT NULL,
  `last_name` VARCHAR(255) NOT NULL,
  `department` VARCHAR(255) DEFAULT 'R&D',
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `roles`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL UNIQUE,
  `description` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `permissions`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `permissions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL UNIQUE,
  `key` VARCHAR(255) NOT NULL UNIQUE,
  `description` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `user_roles`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_roles` (
  `user_id` INT NOT NULL,
  `role_id` INT NOT NULL,
  PRIMARY KEY (`user_id`, `role_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `role_permissions`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `role_id` INT NOT NULL,
  `permission_id` INT NOT NULL,
  PRIMARY KEY (`role_id`, `permission_id`),
  FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `refresh_tokens`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `token_hash` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `revoked` TINYINT(1) DEFAULT 0,
  `revoked_at` DATETIME NULL,
  `replaced_by_token_id` INT NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `companies`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `companies` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(255) NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `vendors`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `vendors` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(255) NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `contact_person` VARCHAR(255),
  `email` VARCHAR(255),
  `phone` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `materials`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `materials` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(255) NOT NULL UNIQUE,
  `trade_name` VARCHAR(255) NOT NULL,
  `inci_name` VARCHAR(255),
  `chemical_name` VARCHAR(255),
  `cas_number` VARCHAR(255),
  `supplier_id` INT,
  `cost` DECIMAL(15, 6) DEFAULT 0.000000,
  `currency_code` VARCHAR(10) DEFAULT 'PHP',
  `density_kg_per_l` DECIMAL(10, 6) DEFAULT 1.000000,
  `specific_gravity` DECIMAL(10, 6) DEFAULT 1.000000,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`supplier_id`) REFERENCES `vendors`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `formulas`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `formulas` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(255) NOT NULL UNIQUE,
  `name` VARCHAR(255) NOT NULL,
  `product_category` VARCHAR(255) NOT NULL,
  `product_subcategory` VARCHAR(255),
  `brand_type` VARCHAR(255),
  `department` VARCHAR(255) DEFAULT 'R&D',
  `status` VARCHAR(50) DEFAULT 'DRAFT',
  `approved_version_id` INT,
  `created_by` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `formula_versions`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `formula_versions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `formula_id` INT NOT NULL,
  `major_version` INT DEFAULT 1,
  `minor_version` INT DEFAULT 0,
  `change_type` VARCHAR(50) DEFAULT 'INITIAL',
  `revision_reason` TEXT,
  `version_status` VARCHAR(50) DEFAULT 'DRAFT',
  `lock_version` INT DEFAULT 0,
  `target_batch_size` DECIMAL(15, 6) DEFAULT 100.000000,
  `target_batch_uom` VARCHAR(50) DEFAULT 'kg',
  `created_by` INT NOT NULL,
  `reviewed_by` INT,
  `approved_by` INT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`formula_id`) REFERENCES `formulas`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`),
  FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`),
  FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `formula_phases`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `formula_phases` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `version_id` INT NOT NULL,
  `phase_name` VARCHAR(255) NOT NULL,
  `phase_order` INT DEFAULT 1,
  `instructions` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`version_id`) REFERENCES `formula_versions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `formula_version_materials`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `formula_version_materials` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `version_id` INT NOT NULL,
  `phase_id` INT,
  `material_id` INT NOT NULL,
  `percentage` DECIMAL(10, 6) NOT NULL,
  `target_quantity` DECIMAL(15, 6),
  `uom` VARCHAR(50) DEFAULT 'kg',
  `addition_order` INT DEFAULT 1,
  `function_description` VARCHAR(255),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`version_id`) REFERENCES `formula_versions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`phase_id`) REFERENCES `formula_phases`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `formula_instructions`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `formula_instructions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `version_id` INT NOT NULL,
  `step_number` INT NOT NULL,
  `instruction_text` TEXT NOT NULL,
  `temperature_celsius` DECIMAL(8, 2),
  `mixing_speed_rpm` INT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`version_id`) REFERENCES `formula_versions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `cosmetic_formula_details`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cosmetic_formula_details` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `version_id` INT NOT NULL UNIQUE,
  `target_ph` VARCHAR(100),
  `viscosity_cp` VARCHAR(100),
  `appearance` VARCHAR(255),
  `color` VARCHAR(255),
  `odor` VARCHAR(255),
  `texture` VARCHAR(255),
  `preservative_system` TEXT,
  `manufacturing_conditions` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`version_id`) REFERENCES `formula_versions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `perfume_formula_details`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `perfume_formula_details` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `version_id` INT NOT NULL UNIQUE,
  `concentration_tier` VARCHAR(100) DEFAULT 'Eau de Parfum',
  `fragrance_pct` DECIMAL(10, 6) DEFAULT 0.000000,
  `alcohol_pct` DECIMAL(10, 6) DEFAULT 0.000000,
  `water_pct` DECIMAL(10, 6) DEFAULT 0.000000,
  `fixative_pct` DECIMAL(10, 6) DEFAULT 0.000000,
  `solubilizer_pct` DECIMAL(10, 6) DEFAULT 0.000000,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`version_id`) REFERENCES `formula_versions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `supplement_formula_details`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `supplement_formula_details` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `version_id` INT NOT NULL UNIQUE,
  `dosage_form` VARCHAR(100) DEFAULT 'Capsules',
  `composition_mode` VARCHAR(50) DEFAULT 'PERCENTAGE',
  `serving_size` DECIMAL(15, 6) DEFAULT 1.000000,
  `serving_uom` VARCHAR(50) DEFAULT 'serving',
  `target_weight_mg` DECIMAL(15, 6),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`version_id`) REFERENCES `formula_versions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `system_settings`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `system_settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `setting_key` VARCHAR(255) NOT NULL UNIQUE,
  `setting_value` TEXT NOT NULL,
  `description` TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Table structure for `audit_logs`
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT,
  `action` VARCHAR(255) NOT NULL,
  `entity_type` VARCHAR(255) NOT NULL,
  `entity_id` INT,
  `details` TEXT,
  `ip_address` VARCHAR(100),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------
-- Initial Seed Data: Default Super Admin User & Roles
-- --------------------------------------------------------
INSERT IGNORE INTO `roles` (`id`, `name`, `description`) VALUES
(1, 'Super Admin', 'Full system control and administration'),
(2, 'Formulator', 'Can create and edit draft formulas'),
(3, 'Reviewer', 'Can review and return/endorse formulas'),
(4, 'Approver', 'Can approve or reject submitted formulas'),
(5, 'Viewer', 'Read-only access to formulas and reports');

-- Passwords: Admin@123456 ($2a$10$7s/L4wzYvXj1uB4k1u)
INSERT IGNORE INTO `users` (`id`, `username`, `email`, `password_hash`, `first_name`, `last_name`, `department`, `is_active`) VALUES
(1, 'superadmin', 'admin@nkb.com', '$2a$10$44.eK4T2F/dlyO2zX23K9eB7gG7L1b1k9J1L.Z6L9L1L9L1L9L1L9', 'System', 'Admin', 'Management', 1);

INSERT IGNORE INTO `user_roles` (`user_id`, `role_id`) VALUES
(1, 1);

-- System Default Settings
INSERT IGNORE INTO `system_settings` (`setting_key`, `setting_value`, `description`) VALUES
('percentage_display_decimals', '2', 'Number of decimal places for percentage displays'),
('quantity_display_decimals', '2', 'Number of decimal places for quantity displays'),
('cost_display_decimals', '2', 'Number of decimal places for cost displays'),
('percentage_tolerance', '0.010000', 'Validation engine percentage sum tolerance'),
('system_company_name', 'NKB Manufacturing Corp.', 'System Company Name');

SET FOREIGN_KEY_CHECKS = 1;
COMMIT;
