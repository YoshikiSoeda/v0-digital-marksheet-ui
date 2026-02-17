-- Update admin account password from 'admin123' to 'admin'
UPDATE admins 
SET password = 'admin'
WHERE email = 'admin';

-- Verify the update
SELECT email, name, account_type FROM admins WHERE email = 'admin';
