-- Cómo se registró el médico: con el formulario y confirmación por correo, o con su cuenta de Google (correo ya
-- verificado por Google). Aditiva: los leads existentes quedan como 'correo'. No se guarda el identificador de Google.
ALTER TABLE leads ADD COLUMN metodo_registro TEXT NOT NULL DEFAULT 'correo' CHECK (metodo_registro IN ('correo', 'google'));
