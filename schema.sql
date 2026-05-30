-- ============================================================
-- Healthcare SaaS Database Schema
-- Database: healthcare_saas
-- Created: 2026-05-30
-- ============================================================

CREATE DATABASE IF NOT EXISTS healthcare_saas
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE healthcare_saas;

-- ─── PATIENTS ────────────────────────────────────────────────
CREATE TABLE patients (
  id              INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  patient_id      VARCHAR(20)       NOT NULL UNIQUE,          -- e.g. SAMH-10001
  full_name       VARCHAR(150)      NOT NULL,
  mobile          VARCHAR(15)       NOT NULL UNIQUE,
  gender          ENUM('Male','Female','Other') NOT NULL,
  dob             DATE              NOT NULL,
  blood_group     ENUM('A+','A-','B+','B-','O+','O-','AB+','AB-') DEFAULT NULL,
  address         TEXT              DEFAULT NULL,
  profile_photo   VARCHAR(500)      DEFAULT NULL,
  password_hash   VARCHAR(255)      DEFAULT NULL,
  is_active       TINYINT(1)        NOT NULL DEFAULT 1,
  created_at      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_patient_id  (patient_id),
  INDEX idx_mobile      (mobile)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── AUTH OTP LOG (audit trail) ──────────────────────────────
CREATE TABLE auth_otp_log (
  id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  mobile      VARCHAR(15)     NOT NULL,
  otp         VARCHAR(10)     NOT NULL,
  is_used     TINYINT(1)      NOT NULL DEFAULT 0,
  expires_at  DATETIME        NOT NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_mobile_otp (mobile, is_used)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── DOCTORS ─────────────────────────────────────────────────
CREATE TABLE doctors (
  id                    INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  full_name             VARCHAR(150)      NOT NULL,
  specialization        VARCHAR(100)      NOT NULL,
  qualification         VARCHAR(200)      DEFAULT NULL,
  experience_years      TINYINT UNSIGNED  DEFAULT 0,
  consultation_fee      DECIMAL(10,2)     DEFAULT 0.00,
  profile_photo         VARCHAR(500)      DEFAULT NULL,
  available_days        VARCHAR(100)      DEFAULT 'Mon,Tue,Wed,Thu,Fri',  -- CSV
  slot_duration_minutes TINYINT UNSIGNED  DEFAULT 15,
  is_active             TINYINT(1)        NOT NULL DEFAULT 1,
  created_at            DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_specialization (specialization),
  INDEX idx_is_active      (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── APPOINTMENTS ────────────────────────────────────────────
CREATE TABLE appointments (
  id                INT UNSIGNED        NOT NULL AUTO_INCREMENT,
  patient_id        INT UNSIGNED        NOT NULL,
  doctor_id         INT UNSIGNED        NOT NULL,
  appointment_date  DATE                NOT NULL,
  slot_time         VARCHAR(20)         NOT NULL,           -- e.g. "11:00 AM"
  token_number      SMALLINT UNSIGNED   NOT NULL,
  status            ENUM('booked','waiting','in_progress','completed','cancelled')
                                        NOT NULL DEFAULT 'booked',
  consultation_fee  DECIMAL(10,2)       DEFAULT 0.00,
  notes             TEXT                DEFAULT NULL,
  created_at        DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_doctor_date_slot (doctor_id, appointment_date, slot_time),
  INDEX idx_patient_id       (patient_id),
  INDEX idx_doctor_date      (doctor_id, appointment_date),
  INDEX idx_status           (status),
  CONSTRAINT fk_appt_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  CONSTRAINT fk_appt_doctor  FOREIGN KEY (doctor_id)  REFERENCES doctors(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── QUEUE TRACKER ───────────────────────────────────────────
CREATE TABLE queue_tracker (
  id                    INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  doctor_id             INT UNSIGNED      NOT NULL,
  date                  DATE              NOT NULL,
  current_token         SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  estimated_wait_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  status                ENUM('Running','Paused','Closed') NOT NULL DEFAULT 'Running',
  updated_at            DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_doctor_date (doctor_id, date),
  CONSTRAINT fk_queue_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── WELLNESS LOGS ───────────────────────────────────────────
CREATE TABLE wellness_logs (
  id            INT UNSIGNED        NOT NULL AUTO_INCREMENT,
  patient_id    INT UNSIGNED        NOT NULL UNIQUE,        -- latest reading per patient
  bp            VARCHAR(20)         DEFAULT NULL,           -- e.g. "140/90"
  sugar         VARCHAR(20)         DEFAULT NULL,           -- mg/dL
  sleep_hours   DECIMAL(3,1)        DEFAULT NULL,
  stress_level  TINYINT UNSIGNED    DEFAULT NULL,           -- 0-100
  allergies     JSON                DEFAULT NULL,           -- ["Penicillin","Dust"]
  notes         TEXT                DEFAULT NULL,
  updated_at    DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_wellness_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── THERAPY SESSIONS ────────────────────────────────────────
CREATE TABLE therapy_sessions (
  id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  patient_id      INT UNSIGNED    NOT NULL,
  therapy_name    VARCHAR(100)    NOT NULL,
  therapist_name  VARCHAR(150)    DEFAULT NULL,
  room_number     VARCHAR(20)     DEFAULT NULL,
  session_date    DATE            NOT NULL,
  scheduled_time  VARCHAR(20)     DEFAULT NULL,
  duration_mins   TINYINT UNSIGNED DEFAULT 30,
  status          ENUM('scheduled','in_progress','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  notes           TEXT            DEFAULT NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_patient_date (patient_id, session_date),
  CONSTRAINT fk_therapy_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── NOTIFICATIONS ───────────────────────────────────────────
CREATE TABLE notifications (
  id          INT UNSIGNED        NOT NULL AUTO_INCREMENT,
  patient_id  INT UNSIGNED        NOT NULL,
  title       VARCHAR(200)        NOT NULL,
  message     TEXT                NOT NULL,
  type        ENUM('appointment','wellness','therapy','system','pharmacy') NOT NULL DEFAULT 'system',
  is_read     TINYINT(1)          NOT NULL DEFAULT 0,
  created_at  DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_patient_unread (patient_id, is_read),
  CONSTRAINT fk_notif_patient FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── PHARMACY (optional module) ──────────────────────────────
CREATE TABLE prescriptions (
  id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  patient_id      INT UNSIGNED    NOT NULL,
  appointment_id  INT UNSIGNED    DEFAULT NULL,
  doctor_id       INT UNSIGNED    NOT NULL,
  medicines       JSON            NOT NULL,   -- [{name, dosage, frequency, days}]
  issued_date     DATE            NOT NULL DEFAULT (CURDATE()),
  status          ENUM('issued','dispensed','cancelled') NOT NULL DEFAULT 'issued',
  notes           TEXT            DEFAULT NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_patient_prescription (patient_id, issued_date),
  CONSTRAINT fk_rx_patient     FOREIGN KEY (patient_id)     REFERENCES patients(id)     ON DELETE CASCADE,
  CONSTRAINT fk_rx_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
  CONSTRAINT fk_rx_doctor      FOREIGN KEY (doctor_id)      REFERENCES doctors(id)      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ═══════════════════════════════════════════════════════════
-- SEED DATA - Sample doctors and a test patient
-- ═══════════════════════════════════════════════════════════

INSERT INTO doctors (full_name, specialization, qualification, experience_years, consultation_fee, available_days) VALUES
  ('Dr. Rajesh Kumar',   'General Physician',   'MBBS, MD',          15, 500.00, 'Mon,Tue,Wed,Thu,Fri'),
  ('Dr. Priya Sharma',   'Cardiologist',        'MBBS, DM Cardio',   12, 1200.00,'Mon,Wed,Fri'),
  ('Dr. Arun Venkat',    'Orthopedic Surgeon',  'MBBS, MS Ortho',    10, 900.00, 'Tue,Thu,Sat'),
  ('Dr. Meena Rajan',    'Dermatologist',       'MBBS, DVD',          8, 700.00, 'Mon,Tue,Wed,Thu,Fri'),
  ('Dr. Suresh Pillai',  'Neurologist',         'MBBS, DM Neuro',    18, 1500.00,'Mon,Wed,Fri'),
  ('Dr. Kavitha Nair',   'Physiotherapist',     'BPT, MPT',           6, 400.00, 'Mon,Tue,Wed,Thu,Fri,Sat'),
  ('Dr. Ramesh Babu',    'Psychiatrist',        'MBBS, MD Psych',    14, 1000.00,'Tue,Thu'),
  ('Dr. Anitha Menon',   'Gynecologist',        'MBBS, MS OBG',      11, 850.00, 'Mon,Tue,Wed,Thu,Fri');

-- Test patient: patient_id = SAMH-10001, password = 123456 (bcrypt hash)
INSERT INTO patients (patient_id, full_name, mobile, gender, dob, blood_group, address, password_hash)
VALUES (
  'SAMH-10001', 'Arun Kumar', '9876543210', 'Male', '1995-08-12', 'O+', 'Chennai, Tamil Nadu',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewFz6jWpJ0NZPWEO'
);

INSERT INTO wellness_logs (patient_id, bp, sugar, sleep_hours, stress_level, allergies)
VALUES (1, '140/90', '168', 7.0, 62, '["Penicillin"]');

INSERT INTO therapy_sessions (patient_id, therapy_name, therapist_name, room_number, session_date, scheduled_time)
VALUES (1, 'Physiotherapy', 'Dr. Kavitha Nair', 'Room 204', CURDATE(), '02:00 PM');

INSERT INTO appointments (patient_id, doctor_id, appointment_date, slot_time, token_number, status, consultation_fee)
VALUES (1, 1, CURDATE(), '11:00 AM', 24, 'booked', 500.00);

INSERT INTO queue_tracker (doctor_id, date, current_token, estimated_wait_minutes, status)
VALUES (1, CURDATE(), 20, 18, 'Running');

INSERT INTO notifications (patient_id, title, message, type)
VALUES
  (1, 'Appointment Reminder', 'Your appointment with Dr. Rajesh Kumar is at 11:00 AM today.', 'appointment'),
  (1, 'Wellness Alert', 'Your blood sugar is above normal. Please monitor your diet.', 'wellness');

SELECT 'Schema created successfully! Test Patient ID: SAMH-10001, Password: 123456' AS status;
