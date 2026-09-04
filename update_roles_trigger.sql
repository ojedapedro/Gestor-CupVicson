-- 1. Eliminar la restricción CHECK actual de 'rol' y crearla de nuevo incluyendo 'pendiente'
ALTER TABLE public.user_sucursal 
  DROP CONSTRAINT IF EXISTS user_sucursal_rol_check;

ALTER TABLE public.user_sucursal 
  ADD CONSTRAINT user_sucursal_rol_check 
  CHECK (rol IN ('admin', 'gerente', 'operador', 'pendiente'));

-- 2. Hacer que sucursal_id pueda ser NULL (ya que los usuarios nuevos no tienen sucursal)
ALTER TABLE public.user_sucursal 
  ALTER COLUMN sucursal_id DROP NOT NULL;

-- 3. Crear una función que se ejecute después de que un usuario se registre en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_sucursal (user_id, rol, sucursal_id)
  VALUES (new.id, 'pendiente', NULL);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Crear el trigger en la tabla auth.users
-- Primero lo eliminamos por si acaso ya existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Dar permisos a la función para que el trigger no falle por falta de privilegios
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon;
