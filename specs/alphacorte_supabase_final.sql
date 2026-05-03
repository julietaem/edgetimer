-- ============================================================
--  AlphaCorte - Base de datos final para Supabase
--  Ejecutar en el SQL Editor de Supabase sobre un proyecto nuevo
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE SCHEMA IF NOT EXISTS private;

-- ============================================================
--  TIPOS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rol_usuario') THEN
    CREATE TYPE rol_usuario AS ENUM ('cliente', 'barbero', 'admin');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_slot') THEN
    CREATE TYPE estado_slot AS ENUM ('disponible', 'reservado', 'bloqueado', 'cancelado');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_cita') THEN
    CREATE TYPE estado_cita AS ENUM (
      'solicitada',
      'pendiente',
      'confirmada',
      'completada',
      'cancelada',
      'rechazada'
    );
  END IF;
END $$;

-- ============================================================
--  PERFIL GENERAL
--  Supabase Auth guarda email/contrasena en auth.users.
--  Esta tabla guarda el rol usado por la app.
-- ============================================================

CREATE TABLE IF NOT EXISTS perfil (
  id_perfil  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  rol        rol_usuario NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  CLIENTE
-- ============================================================

CREATE TABLE IF NOT EXISTS cliente (
  id_cliente     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_cliente VARCHAR(128) NOT NULL CHECK (LENGTH(TRIM(nombre_cliente)) > 0),
  telefono       VARCHAR(20),
  foto_perfil    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  BARBERO
--  Los barberos pueden cargarse antes de tener user_id.
--  Cuando el admin cree su usuario en Supabase Auth, se actualiza user_id.
-- ============================================================

CREATE TABLE IF NOT EXISTS barbero (
  id_barbero            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  nombre_barbero        VARCHAR(128) NOT NULL CHECK (LENGTH(TRIM(nombre_barbero)) > 0),
  telefono              VARCHAR(20),
  email                 VARCHAR(255) UNIQUE,
  foto_perfil           TEXT,
  promedio_calificacion NUMERIC(3,2) NOT NULL DEFAULT 0.00
                          CHECK (promedio_calificacion BETWEEN 0.00 AND 5.00),
  activo                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  PROCEDIMIENTO
-- ============================================================

CREATE TABLE IF NOT EXISTS procedimiento (
  id_procedimiento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           VARCHAR(128) NOT NULL UNIQUE CHECK (LENGTH(TRIM(nombre)) > 0),
  descripcion      VARCHAR(500),
  precio           NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
  duracion_minutos INT NOT NULL CHECK (duracion_minutos > 0),
  activo           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  ESPECIALIDADES DEL BARBERO
-- ============================================================

CREATE TABLE IF NOT EXISTS barbero_procedimiento (
  id_barbero       UUID NOT NULL REFERENCES barbero(id_barbero) ON DELETE CASCADE,
  id_procedimiento UUID NOT NULL REFERENCES procedimiento(id_procedimiento) ON DELETE CASCADE,
  PRIMARY KEY (id_barbero, id_procedimiento)
);

-- ============================================================
--  SLOTS DISPONIBLES
--  Todos los barberos trabajan de lunes a viernes.
--  El barbero abre slots concretos dentro de esa semana laboral.
-- ============================================================

CREATE TABLE IF NOT EXISTS slot_cita (
  id_slot    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_barbero UUID NOT NULL REFERENCES barbero(id_barbero) ON DELETE CASCADE,
  inicio_at  TIMESTAMPTZ NOT NULL,
  fin_at     TIMESTAMPTZ NOT NULL,
  estado     estado_slot NOT NULL DEFAULT 'disponible',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (fin_at > inicio_at),
  CHECK (EXTRACT(ISODOW FROM inicio_at) BETWEEN 1 AND 5),
  CHECK (EXTRACT(ISODOW FROM fin_at) BETWEEN 1 AND 5)
);

ALTER TABLE slot_cita
  DROP CONSTRAINT IF EXISTS no_slots_solapados_barbero;

ALTER TABLE slot_cita
  ADD CONSTRAINT no_slots_solapados_barbero
  EXCLUDE USING gist (
    id_barbero WITH =,
    tstzrange(inicio_at, fin_at, '[)') WITH &&
  )
  WHERE (estado IN ('disponible', 'reservado', 'bloqueado'));

-- ============================================================
--  CITA
--  id_slot es opcional para permitir solicitudes de horarios
--  que no estaban publicados como disponibles.
-- ============================================================

CREATE TABLE IF NOT EXISTS cita (
  id_cita       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cliente    UUID NOT NULL REFERENCES cliente(id_cliente) ON DELETE RESTRICT,
  id_barbero    UUID NOT NULL REFERENCES barbero(id_barbero) ON DELETE RESTRICT,
  id_slot       UUID UNIQUE REFERENCES slot_cita(id_slot) ON DELETE SET NULL,
  inicio_at     TIMESTAMPTZ NOT NULL,
  fin_at        TIMESTAMPTZ NOT NULL,
  estado        estado_cita NOT NULL DEFAULT 'pendiente',
  notas_cliente VARCHAR(500),
  motivo_estado VARCHAR(500),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (fin_at > inicio_at),
  CHECK (EXTRACT(ISODOW FROM inicio_at) BETWEEN 1 AND 5),
  CHECK (EXTRACT(ISODOW FROM fin_at) BETWEEN 1 AND 5)
);

ALTER TABLE cita
  DROP CONSTRAINT IF EXISTS no_citas_solapadas_barbero;

ALTER TABLE cita
  ADD CONSTRAINT no_citas_solapadas_barbero
  EXCLUDE USING gist (
    id_barbero WITH =,
    tstzrange(inicio_at, fin_at, '[)') WITH &&
  )
  WHERE (estado IN ('solicitada', 'pendiente', 'confirmada'));

ALTER TABLE cita
  DROP CONSTRAINT IF EXISTS no_citas_solapadas_cliente;

ALTER TABLE cita
  ADD CONSTRAINT no_citas_solapadas_cliente
  EXCLUDE USING gist (
    id_cliente WITH =,
    tstzrange(inicio_at, fin_at, '[)') WITH &&
  )
  WHERE (estado IN ('solicitada', 'pendiente', 'confirmada'));

-- ============================================================
--  PROCEDIMIENTOS DE LA CITA
-- ============================================================

CREATE TABLE IF NOT EXISTS cita_procedimiento (
  id_cita          UUID NOT NULL REFERENCES cita(id_cita) ON DELETE CASCADE,
  id_procedimiento UUID NOT NULL REFERENCES procedimiento(id_procedimiento) ON DELETE RESTRICT,
  PRIMARY KEY (id_cita, id_procedimiento)
);

-- ============================================================
--  CALIFICACION
--  Una cita completada solo puede tener una calificacion.
-- ============================================================

CREATE TABLE IF NOT EXISTS calificacion (
  id_calificacion     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cita             UUID NOT NULL UNIQUE REFERENCES cita(id_cita) ON DELETE CASCADE,
  puntuacion_numerica INT NOT NULL CHECK (puntuacion_numerica BETWEEN 1 AND 5),
  resena              VARCHAR(500),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
--  INDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_cliente_user_id ON cliente(user_id);
CREATE INDEX IF NOT EXISTS idx_barbero_user_id ON barbero(user_id);
CREATE INDEX IF NOT EXISTS idx_barbero_activo ON barbero(activo);
CREATE INDEX IF NOT EXISTS idx_procedimiento_activo ON procedimiento(activo);
CREATE INDEX IF NOT EXISTS idx_slot_barbero_inicio ON slot_cita(id_barbero, inicio_at);
CREATE INDEX IF NOT EXISTS idx_slot_estado_inicio ON slot_cita(estado, inicio_at);
CREATE INDEX IF NOT EXISTS idx_cita_cliente_inicio ON cita(id_cliente, inicio_at);
CREATE INDEX IF NOT EXISTS idx_cita_barbero_inicio ON cita(id_barbero, inicio_at);
CREATE INDEX IF NOT EXISTS idx_cita_estado ON cita(estado);

-- ============================================================
--  FUNCIONES AUXILIARES
-- ============================================================

DROP FUNCTION IF EXISTS public.es_admin();
DROP FUNCTION IF EXISTS public.es_cliente_de_cita(UUID);
DROP FUNCTION IF EXISTS public.es_barbero_de_cita(UUID);

CREATE OR REPLACE FUNCTION private.es_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM perfil
    WHERE user_id = auth.uid()
      AND rol = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private;

CREATE OR REPLACE FUNCTION private.es_cliente_de_cita(p_id_cita UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM cita ci
    JOIN cliente cl ON cl.id_cliente = ci.id_cliente
    WHERE ci.id_cita = p_id_cita
      AND cl.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private;

CREATE OR REPLACE FUNCTION private.es_barbero_de_cita(p_id_cita UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM cita ci
    JOIN barbero ba ON ba.id_barbero = ci.id_barbero
    WHERE ci.id_cita = p_id_cita
      AND ba.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.es_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.es_cliente_de_cita(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.es_barbero_de_cita(UUID) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.es_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.es_cliente_de_cita(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.es_barbero_de_cita(UUID) TO anon, authenticated;

-- ============================================================
--  TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cita_updated_at ON cita;
CREATE TRIGGER trg_cita_updated_at
BEFORE UPDATE ON cita
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION validar_cita()
RETURNS TRIGGER AS $$
DECLARE
  v_slot slot_cita%ROWTYPE;
  v_es_cliente BOOLEAN;
  v_es_barbero BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.id_slot IS NULL THEN
      IF NEW.estado <> 'solicitada' THEN
        RAISE EXCEPTION 'Una cita sin slot debe crearse como solicitada';
      END IF;
    ELSE
      SELECT *
      INTO v_slot
      FROM slot_cita
      WHERE id_slot = NEW.id_slot;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'El slot seleccionado no existe';
      END IF;

      IF v_slot.estado <> 'disponible' THEN
        RAISE EXCEPTION 'El slot seleccionado no esta disponible';
      END IF;

      IF v_slot.id_barbero <> NEW.id_barbero
         OR v_slot.inicio_at <> NEW.inicio_at
         OR v_slot.fin_at <> NEW.fin_at THEN
        RAISE EXCEPTION 'La cita debe coincidir con el barbero y horario del slot';
      END IF;

      IF NEW.estado <> 'pendiente' THEN
        RAISE EXCEPTION 'Una cita tomada desde un slot disponible debe crearse como pendiente';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_es_cliente := EXISTS (
      SELECT 1
      FROM cliente cl
      WHERE cl.id_cliente = OLD.id_cliente
        AND cl.user_id = auth.uid()
    );

    v_es_barbero := EXISTS (
      SELECT 1
      FROM barbero ba
      WHERE ba.id_barbero = OLD.id_barbero
        AND ba.user_id = auth.uid()
    );

    IF OLD.estado = 'completada'
       AND NEW.estado <> OLD.estado
       AND NOT private.es_admin() THEN
      RAISE EXCEPTION 'Una cita completada no puede cambiar de estado';
    END IF;

    IF NOT private.es_admin()
       AND (NEW.id_cliente <> OLD.id_cliente OR NEW.id_barbero <> OLD.id_barbero) THEN
      RAISE EXCEPTION 'No se puede cambiar el cliente ni el barbero de una cita existente';
    END IF;

    IF NOT private.es_admin()
       AND NEW.estado <> OLD.estado
       AND NOT (
         (v_es_cliente AND NEW.estado = 'cancelada')
         OR (v_es_barbero AND NEW.estado IN ('confirmada', 'rechazada', 'cancelada'))
         OR (NEW.estado = 'completada' AND OLD.estado IN ('pendiente', 'confirmada') AND NEW.fin_at < NOW())
       ) THEN
      RAISE EXCEPTION 'No tienes permisos para hacer esta transicion de estado';
    END IF;

    IF NOT private.es_admin()
       AND (NEW.inicio_at <> OLD.inicio_at OR NEW.fin_at <> OLD.fin_at)
       AND NOT (v_es_cliente OR v_es_barbero) THEN
      RAISE EXCEPTION 'Solo el cliente o el barbero de la cita pueden reprogramarla';
    END IF;

    IF NEW.id_slot IS NOT NULL THEN
      SELECT *
      INTO v_slot
      FROM slot_cita
      WHERE id_slot = NEW.id_slot;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'El slot seleccionado no existe';
      END IF;

      IF v_slot.id_barbero <> NEW.id_barbero
         OR v_slot.inicio_at <> NEW.inicio_at
         OR v_slot.fin_at <> NEW.fin_at THEN
        RAISE EXCEPTION 'La cita debe coincidir con el barbero y horario del slot';
      END IF;

      IF OLD.id_slot IS DISTINCT FROM NEW.id_slot
         AND v_slot.estado <> 'disponible' THEN
        RAISE EXCEPTION 'El nuevo slot seleccionado no esta disponible';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_cita ON cita;
CREATE TRIGGER trg_validar_cita
BEFORE INSERT OR UPDATE ON cita
FOR EACH ROW
EXECUTE FUNCTION validar_cita();

CREATE OR REPLACE FUNCTION validar_calificacion()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM cita ci
    WHERE ci.id_cita = NEW.id_cita
      AND ci.estado = 'completada'
  ) THEN
    RAISE EXCEPTION 'Solo se puede calificar una cita completada';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_calificacion ON calificacion;
CREATE TRIGGER trg_validar_calificacion
BEFORE INSERT OR UPDATE ON calificacion
FOR EACH ROW
EXECUTE FUNCTION validar_calificacion();

CREATE OR REPLACE FUNCTION actualizar_promedio_barbero()
RETURNS TRIGGER AS $$
DECLARE
  v_barbero UUID;
BEGIN
  SELECT id_barbero
  INTO v_barbero
  FROM cita
  WHERE id_cita = COALESCE(NEW.id_cita, OLD.id_cita);

  UPDATE barbero
  SET promedio_calificacion = (
    SELECT COALESCE(ROUND(AVG(ca.puntuacion_numerica)::numeric, 2), 0.00)
    FROM cita ci
    JOIN calificacion ca ON ca.id_cita = ci.id_cita
    WHERE ci.id_barbero = v_barbero
  )
  WHERE id_barbero = v_barbero;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_actualizar_promedio_barbero ON calificacion;
CREATE TRIGGER trg_actualizar_promedio_barbero
AFTER INSERT OR UPDATE OR DELETE ON calificacion
FOR EACH ROW
EXECUTE FUNCTION actualizar_promedio_barbero();

CREATE OR REPLACE FUNCTION sincronizar_slot_con_cita()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.id_slot IS NULL THEN
      RETURN NEW;
    END IF;

    UPDATE slot_cita
    SET estado = 'reservado'
    WHERE id_slot = NEW.id_slot
      AND estado = 'disponible';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.id_slot IS NOT NULL
       AND OLD.id_slot IS DISTINCT FROM NEW.id_slot THEN
      UPDATE slot_cita
      SET estado = 'disponible'
      WHERE id_slot = OLD.id_slot
        AND estado = 'reservado'
        AND inicio_at > NOW();
    END IF;

    IF NEW.id_slot IS NULL THEN
      RETURN NEW;
    END IF;

    IF NEW.estado IN ('cancelada', 'rechazada') AND OLD.estado <> NEW.estado THEN
      UPDATE slot_cita
      SET estado = 'disponible'
      WHERE id_slot = NEW.id_slot
        AND estado = 'reservado'
        AND inicio_at > NOW();
    END IF;

    IF NEW.estado IN ('pendiente', 'confirmada') THEN
      UPDATE slot_cita
      SET estado = 'reservado'
      WHERE id_slot = NEW.id_slot;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sincronizar_slot_con_cita_insert ON cita;
CREATE TRIGGER trg_sincronizar_slot_con_cita_insert
AFTER INSERT ON cita
FOR EACH ROW
EXECUTE FUNCTION sincronizar_slot_con_cita();

DROP TRIGGER IF EXISTS trg_sincronizar_slot_con_cita_update ON cita;
CREATE TRIGGER trg_sincronizar_slot_con_cita_update
AFTER UPDATE OF estado, id_slot ON cita
FOR EACH ROW
EXECUTE FUNCTION sincronizar_slot_con_cita();

CREATE OR REPLACE FUNCTION validar_reprogramacion_cancelacion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estado IN ('pendiente', 'confirmada', 'solicitada')
     AND (
       NEW.estado IN ('cancelada', 'rechazada')
       OR NEW.inicio_at <> OLD.inicio_at
       OR NEW.fin_at <> OLD.fin_at
     )
     AND OLD.inicio_at < NOW() + INTERVAL '1 day'
     AND NOT private.es_admin()
  THEN
    RAISE EXCEPTION 'La cita solo se puede cancelar o reprogramar con minimo 1 dia de anticipacion';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_reprogramacion_cancelacion ON cita;
CREATE TRIGGER trg_validar_reprogramacion_cancelacion
BEFORE UPDATE ON cita
FOR EACH ROW
EXECUTE FUNCTION validar_reprogramacion_cancelacion();

CREATE OR REPLACE FUNCTION completar_citas_vencidas()
RETURNS VOID AS $$
BEGIN
  UPDATE cita
  SET estado = 'completada'
  WHERE estado IN ('pendiente', 'confirmada')
    AND fin_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION completar_citas_vencidas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION completar_citas_vencidas() TO service_role;

-- ============================================================
--  RLS
--  Aunque ya lo activaste en Supabase, esto lo deja declarado
--  en el esquema para que sea reproducible.
-- ============================================================

ALTER TABLE perfil ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbero ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE barbero_procedimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_cita ENABLE ROW LEVEL SECURITY;
ALTER TABLE cita ENABLE ROW LEVEL SECURITY;
ALTER TABLE cita_procedimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE calificacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "perfil_select_propio" ON perfil;
CREATE POLICY "perfil_select_propio"
ON perfil FOR SELECT
USING (user_id = auth.uid() OR private.es_admin());

DROP POLICY IF EXISTS "perfil_insert_propio" ON perfil;
CREATE POLICY "perfil_insert_propio"
ON perfil FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "cliente_select_publico_controlado" ON cliente;
CREATE POLICY "cliente_select_publico_controlado"
ON cliente FOR SELECT
USING (
  user_id = auth.uid()
  OR private.es_admin()
  OR EXISTS (
    SELECT 1
    FROM cita ci
    JOIN barbero ba ON ba.id_barbero = ci.id_barbero
    WHERE ci.id_cliente = cliente.id_cliente
      AND ba.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "cliente_insert_propio" ON cliente;
CREATE POLICY "cliente_insert_propio"
ON cliente FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "cliente_update_propio" ON cliente;
CREATE POLICY "cliente_update_propio"
ON cliente FOR UPDATE
USING (user_id = auth.uid() OR private.es_admin())
WITH CHECK (user_id = auth.uid() OR private.es_admin());

DROP POLICY IF EXISTS "barbero_select_activos" ON barbero;
CREATE POLICY "barbero_select_activos"
ON barbero FOR SELECT
USING (activo = TRUE OR user_id = auth.uid() OR private.es_admin());

DROP POLICY IF EXISTS "barbero_update_propio" ON barbero;
CREATE POLICY "barbero_update_propio"
ON barbero FOR UPDATE
USING (user_id = auth.uid() OR private.es_admin())
WITH CHECK (user_id = auth.uid() OR private.es_admin());

DROP POLICY IF EXISTS "procedimiento_select_activos" ON procedimiento;
CREATE POLICY "procedimiento_select_activos"
ON procedimiento FOR SELECT
USING (activo = TRUE OR private.es_admin());

DROP POLICY IF EXISTS "procedimiento_admin_all" ON procedimiento;
CREATE POLICY "procedimiento_admin_all"
ON procedimiento FOR ALL
USING (private.es_admin())
WITH CHECK (private.es_admin());

DROP POLICY IF EXISTS "barbero_procedimiento_select" ON barbero_procedimiento;
CREATE POLICY "barbero_procedimiento_select"
ON barbero_procedimiento FOR SELECT
USING (TRUE);

DROP POLICY IF EXISTS "barbero_procedimiento_admin_all" ON barbero_procedimiento;
CREATE POLICY "barbero_procedimiento_admin_all"
ON barbero_procedimiento FOR ALL
USING (private.es_admin())
WITH CHECK (private.es_admin());

DROP POLICY IF EXISTS "slot_select_disponibles_o_propios" ON slot_cita;
CREATE POLICY "slot_select_disponibles_o_propios"
ON slot_cita FOR SELECT
USING (
  (estado = 'disponible' AND inicio_at >= NOW())
  OR private.es_admin()
  OR EXISTS (
    SELECT 1
    FROM barbero ba
    WHERE ba.id_barbero = slot_cita.id_barbero
      AND ba.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "slot_insert_barbero" ON slot_cita;
CREATE POLICY "slot_insert_barbero"
ON slot_cita FOR INSERT
WITH CHECK (
  private.es_admin()
  OR EXISTS (
    SELECT 1
    FROM barbero ba
    WHERE ba.id_barbero = slot_cita.id_barbero
      AND ba.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "slot_update_barbero" ON slot_cita;
CREATE POLICY "slot_update_barbero"
ON slot_cita FOR UPDATE
USING (
  private.es_admin()
  OR EXISTS (
    SELECT 1
    FROM barbero ba
    WHERE ba.id_barbero = slot_cita.id_barbero
      AND ba.user_id = auth.uid()
  )
)
WITH CHECK (
  private.es_admin()
  OR EXISTS (
    SELECT 1
    FROM barbero ba
    WHERE ba.id_barbero = slot_cita.id_barbero
      AND ba.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "cita_select_participantes" ON cita;
CREATE POLICY "cita_select_participantes"
ON cita FOR SELECT
USING (
  private.es_admin()
  OR EXISTS (
    SELECT 1 FROM cliente cl
    WHERE cl.id_cliente = cita.id_cliente
      AND cl.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM barbero ba
    WHERE ba.id_barbero = cita.id_barbero
      AND ba.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "cita_insert_cliente" ON cita;
CREATE POLICY "cita_insert_cliente"
ON cita FOR INSERT
WITH CHECK (
  private.es_admin()
  OR EXISTS (
    SELECT 1
    FROM cliente cl
    WHERE cl.id_cliente = cita.id_cliente
      AND cl.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "cita_update_participantes" ON cita;
CREATE POLICY "cita_update_participantes"
ON cita FOR UPDATE
USING (
  private.es_admin()
  OR EXISTS (
    SELECT 1 FROM cliente cl
    WHERE cl.id_cliente = cita.id_cliente
      AND cl.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM barbero ba
    WHERE ba.id_barbero = cita.id_barbero
      AND ba.user_id = auth.uid()
  )
)
WITH CHECK (
  private.es_admin()
  OR EXISTS (
    SELECT 1 FROM cliente cl
    WHERE cl.id_cliente = cita.id_cliente
      AND cl.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM barbero ba
    WHERE ba.id_barbero = cita.id_barbero
      AND ba.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "cita_procedimiento_select_participantes" ON cita_procedimiento;
CREATE POLICY "cita_procedimiento_select_participantes"
ON cita_procedimiento FOR SELECT
USING (private.es_cliente_de_cita(id_cita) OR private.es_barbero_de_cita(id_cita) OR private.es_admin());

DROP POLICY IF EXISTS "cita_procedimiento_insert_cliente" ON cita_procedimiento;
CREATE POLICY "cita_procedimiento_insert_cliente"
ON cita_procedimiento FOR INSERT
WITH CHECK (private.es_cliente_de_cita(id_cita) OR private.es_admin());

DROP POLICY IF EXISTS "cita_procedimiento_update_participantes" ON cita_procedimiento;
CREATE POLICY "cita_procedimiento_update_participantes"
ON cita_procedimiento FOR UPDATE
USING (private.es_cliente_de_cita(id_cita) OR private.es_barbero_de_cita(id_cita) OR private.es_admin())
WITH CHECK (private.es_cliente_de_cita(id_cita) OR private.es_barbero_de_cita(id_cita) OR private.es_admin());

DROP POLICY IF EXISTS "cita_procedimiento_delete_participantes" ON cita_procedimiento;
CREATE POLICY "cita_procedimiento_delete_participantes"
ON cita_procedimiento FOR DELETE
USING (private.es_cliente_de_cita(id_cita) OR private.es_barbero_de_cita(id_cita) OR private.es_admin());

DROP POLICY IF EXISTS "calificacion_select_participantes" ON calificacion;
CREATE POLICY "calificacion_select_participantes"
ON calificacion FOR SELECT
USING (private.es_cliente_de_cita(id_cita) OR private.es_barbero_de_cita(id_cita) OR private.es_admin());

DROP POLICY IF EXISTS "calificacion_insert_cliente" ON calificacion;
CREATE POLICY "calificacion_insert_cliente"
ON calificacion FOR INSERT
WITH CHECK (private.es_cliente_de_cita(id_cita) OR private.es_admin());

DROP POLICY IF EXISTS "calificacion_update_cliente" ON calificacion;
CREATE POLICY "calificacion_update_cliente"
ON calificacion FOR UPDATE
USING (private.es_cliente_de_cita(id_cita) OR private.es_admin())
WITH CHECK (private.es_cliente_de_cita(id_cita) OR private.es_admin());

-- ============================================================
--  DATOS INICIALES
-- ============================================================

WITH barberos_auth (id, email, password, nombre) AS (
  VALUES
    ('11111111-1111-4111-8111-111111111111'::uuid, 'carlos@alphacorte.com', 'Carlos.AC.2026!', 'Carlos Mendoza'),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'miguel@alphacorte.com', 'Miguel.AC.2026!', 'Miguel Torres'),
    ('33333333-3333-4333-8333-333333333333'::uuid, 'andres@alphacorte.com', 'Andres.AC.2026!', 'Andres Restrepo'),
    ('44444444-4444-4444-8444-444444444444'::uuid, 'sebastian@alphacorte.com', 'Sebastian.AC.2026!', 'Sebastian Vargas'),
    ('55555555-5555-4555-8555-555555555555'::uuid, 'david@alphacorte.com', 'David.AC.2026!', 'David Ospina')
)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_anonymous
)
SELECT
  '00000000-0000-0000-0000-000000000000'::uuid,
  id,
  'authenticated',
  'authenticated',
  email,
  crypt(password, gen_salt('bf')),
  NOW(),
  '',
  '',
  '',
  '',
  jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
  jsonb_build_object('nombre', nombre, 'rol', 'barbero'),
  NOW(),
  NOW(),
  FALSE
FROM barberos_auth
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = COALESCE(auth.users.email_confirmed_at, EXCLUDED.email_confirmed_at),
  raw_app_meta_data = EXCLUDED.raw_app_meta_data,
  raw_user_meta_data = EXCLUDED.raw_user_meta_data,
  updated_at = NOW();

WITH barberos_auth (id, email, nombre) AS (
  VALUES
    ('11111111-1111-4111-8111-111111111111'::uuid, 'carlos@alphacorte.com', 'Carlos Mendoza'),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'miguel@alphacorte.com', 'Miguel Torres'),
    ('33333333-3333-4333-8333-333333333333'::uuid, 'andres@alphacorte.com', 'Andres Restrepo'),
    ('44444444-4444-4444-8444-444444444444'::uuid, 'sebastian@alphacorte.com', 'Sebastian Vargas'),
    ('55555555-5555-4555-8555-555555555555'::uuid, 'david@alphacorte.com', 'David Ospina')
)
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  id,
  id,
  id::text,
  jsonb_build_object(
    'sub', id::text,
    'email', email,
    'email_verified', TRUE,
    'phone_verified', FALSE,
    'name', nombre
  ),
  'email',
  NOW(),
  NOW(),
  NOW()
FROM barberos_auth
ON CONFLICT (id) DO UPDATE SET
  identity_data = EXCLUDED.identity_data,
  updated_at = NOW();

INSERT INTO perfil (user_id, rol) VALUES
  ('11111111-1111-4111-8111-111111111111'::uuid, 'barbero'),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'barbero'),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'barbero'),
  ('44444444-4444-4444-8444-444444444444'::uuid, 'barbero'),
  ('55555555-5555-4555-8555-555555555555'::uuid, 'barbero')
ON CONFLICT (user_id) DO UPDATE SET
  rol = EXCLUDED.rol;

INSERT INTO procedimiento (nombre, descripcion, precio, duracion_minutos) VALUES
  ('Corte clasico',       'Corte tradicional con tijera y maquina',       25000, 30),
  ('Degradado',           'Fade suave con transicion gradual',            30000, 45),
  ('Degradado alto',      'High fade con contraste marcado',              35000, 45),
  ('Corte con navaja',    'Perfilado y acabado con navaja',               30000, 40),
  ('Arreglo de barba',    'Perfilado, definicion y aceite de barba',      20000, 20),
  ('Tintura',             'Coloracion completa o mechas',                 60000, 60),
  ('Cejas',               'Diseno y depilacion de cejas',                 15000, 15),
  ('Tratamiento capilar', 'Hidratacion y nutricion del cuero cabelludo',  45000, 30)
ON CONFLICT (nombre) DO UPDATE SET
  descripcion = EXCLUDED.descripcion,
  precio = EXCLUDED.precio,
  duracion_minutos = EXCLUDED.duracion_minutos,
  activo = TRUE;

INSERT INTO barbero (user_id, nombre_barbero, telefono, email) VALUES
  ('11111111-1111-4111-8111-111111111111'::uuid, 'Carlos Mendoza',    '3001234567', 'carlos@alphacorte.com'),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'Miguel Torres',     '3107654321', 'miguel@alphacorte.com'),
  ('33333333-3333-4333-8333-333333333333'::uuid, 'Andres Restrepo',   '3209876543', 'andres@alphacorte.com'),
  ('44444444-4444-4444-8444-444444444444'::uuid, 'Sebastian Vargas',  '3155551234', 'sebastian@alphacorte.com'),
  ('55555555-5555-4555-8555-555555555555'::uuid, 'David Ospina',      '3004445566', 'david@alphacorte.com')
ON CONFLICT (email) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  nombre_barbero = EXCLUDED.nombre_barbero,
  telefono = EXCLUDED.telefono,
  activo = TRUE;

INSERT INTO barbero_procedimiento (id_barbero, id_procedimiento)
SELECT ba.id_barbero, pr.id_procedimiento
FROM barbero ba
JOIN procedimiento pr ON pr.nombre IN ('Degradado', 'Degradado alto', 'Corte clasico')
WHERE ba.email = 'carlos@alphacorte.com'
ON CONFLICT DO NOTHING;

INSERT INTO barbero_procedimiento (id_barbero, id_procedimiento)
SELECT ba.id_barbero, pr.id_procedimiento
FROM barbero ba
JOIN procedimiento pr ON pr.nombre IN ('Tintura', 'Tratamiento capilar', 'Corte clasico')
WHERE ba.email = 'miguel@alphacorte.com'
ON CONFLICT DO NOTHING;

INSERT INTO barbero_procedimiento (id_barbero, id_procedimiento)
SELECT ba.id_barbero, pr.id_procedimiento
FROM barbero ba
JOIN procedimiento pr ON pr.nombre IN ('Arreglo de barba', 'Corte con navaja', 'Degradado')
WHERE ba.email = 'andres@alphacorte.com'
ON CONFLICT DO NOTHING;

INSERT INTO barbero_procedimiento (id_barbero, id_procedimiento)
SELECT ba.id_barbero, pr.id_procedimiento
FROM barbero ba
JOIN procedimiento pr ON pr.nombre IN ('Corte clasico', 'Degradado', 'Arreglo de barba', 'Cejas')
WHERE ba.email = 'sebastian@alphacorte.com'
ON CONFLICT DO NOTHING;

INSERT INTO barbero_procedimiento (id_barbero, id_procedimiento)
SELECT ba.id_barbero, pr.id_procedimiento
FROM barbero ba
JOIN procedimiento pr ON pr.nombre IN ('Cejas', 'Corte con navaja', 'Corte clasico', 'Degradado alto')
WHERE ba.email = 'david@alphacorte.com'
ON CONFLICT DO NOTHING;

-- ============================================================
--  ENDURECIMIENTO POST-DESPLIEGUE
--  Mantiene este archivo alineado con el estado final aplicado
--  en Supabase: search_path fijo, FKs indexadas y RLS optimizado.
-- ============================================================

ALTER EXTENSION btree_gist SET SCHEMA extensions;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION validar_cita()
RETURNS TRIGGER AS $$
DECLARE
  v_slot slot_cita%ROWTYPE;
  v_es_cliente BOOLEAN;
  v_es_barbero BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.id_slot IS NULL THEN
      IF NEW.estado <> 'solicitada' THEN
        RAISE EXCEPTION 'Una cita sin slot debe crearse como solicitada';
      END IF;
    ELSE
      SELECT *
      INTO v_slot
      FROM slot_cita
      WHERE id_slot = NEW.id_slot;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'El slot seleccionado no existe';
      END IF;

      IF v_slot.estado <> 'disponible' THEN
        RAISE EXCEPTION 'El slot seleccionado no esta disponible';
      END IF;

      IF v_slot.id_barbero <> NEW.id_barbero
         OR v_slot.inicio_at <> NEW.inicio_at
         OR v_slot.fin_at <> NEW.fin_at THEN
        RAISE EXCEPTION 'La cita debe coincidir con el barbero y horario del slot';
      END IF;

      IF NEW.estado <> 'pendiente' THEN
        RAISE EXCEPTION 'Una cita tomada desde un slot disponible debe crearse como pendiente';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_es_cliente := EXISTS (
      SELECT 1
      FROM cliente cl
      WHERE cl.id_cliente = OLD.id_cliente
        AND cl.user_id = auth.uid()
    );

    v_es_barbero := EXISTS (
      SELECT 1
      FROM barbero ba
      WHERE ba.id_barbero = OLD.id_barbero
        AND ba.user_id = auth.uid()
    );

    IF OLD.estado = 'completada'
       AND NEW.estado <> OLD.estado
       AND NOT private.es_admin() THEN
      RAISE EXCEPTION 'Una cita completada no puede cambiar de estado';
    END IF;

    IF NOT private.es_admin()
       AND (NEW.id_cliente <> OLD.id_cliente OR NEW.id_barbero <> OLD.id_barbero) THEN
      RAISE EXCEPTION 'No se puede cambiar el cliente ni el barbero de una cita existente';
    END IF;

    IF NOT private.es_admin()
       AND NEW.estado <> OLD.estado
       AND NOT (
         (v_es_cliente AND NEW.estado = 'cancelada')
         OR (v_es_barbero AND NEW.estado IN ('confirmada', 'rechazada', 'cancelada'))
         OR (NEW.estado = 'completada' AND OLD.estado IN ('pendiente', 'confirmada') AND NEW.fin_at < NOW())
       ) THEN
      RAISE EXCEPTION 'No tienes permisos para hacer esta transicion de estado';
    END IF;

    IF NOT private.es_admin()
       AND (NEW.inicio_at <> OLD.inicio_at OR NEW.fin_at <> OLD.fin_at)
       AND NOT (v_es_cliente OR v_es_barbero) THEN
      RAISE EXCEPTION 'Solo el cliente o el barbero de la cita pueden reprogramarla';
    END IF;

    IF NEW.id_slot IS NOT NULL THEN
      SELECT *
      INTO v_slot
      FROM slot_cita
      WHERE id_slot = NEW.id_slot;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'El slot seleccionado no existe';
      END IF;

      IF v_slot.id_barbero <> NEW.id_barbero
         OR v_slot.inicio_at <> NEW.inicio_at
         OR v_slot.fin_at <> NEW.fin_at THEN
        RAISE EXCEPTION 'La cita debe coincidir con el barbero y horario del slot';
      END IF;

      IF OLD.id_slot IS DISTINCT FROM NEW.id_slot
         AND v_slot.estado <> 'disponible' THEN
        RAISE EXCEPTION 'El nuevo slot seleccionado no esta disponible';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, private;

CREATE OR REPLACE FUNCTION validar_calificacion()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM cita ci
    WHERE ci.id_cita = NEW.id_cita
      AND ci.estado = 'completada'
  ) THEN
    RAISE EXCEPTION 'Solo se puede calificar una cita completada';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION actualizar_promedio_barbero()
RETURNS TRIGGER AS $$
DECLARE
  v_barbero UUID;
BEGIN
  SELECT id_barbero
  INTO v_barbero
  FROM cita
  WHERE id_cita = COALESCE(NEW.id_cita, OLD.id_cita);

  UPDATE barbero
  SET promedio_calificacion = (
    SELECT COALESCE(ROUND(AVG(ca.puntuacion_numerica)::numeric, 2), 0.00)
    FROM cita ci
    JOIN calificacion ca ON ca.id_cita = ci.id_cita
    WHERE ci.id_barbero = v_barbero
  )
  WHERE id_barbero = v_barbero;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION sincronizar_slot_con_cita()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.id_slot IS NULL THEN
      RETURN NEW;
    END IF;

    UPDATE slot_cita
    SET estado = 'reservado'
    WHERE id_slot = NEW.id_slot
      AND estado = 'disponible';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.id_slot IS NOT NULL
       AND OLD.id_slot IS DISTINCT FROM NEW.id_slot THEN
      UPDATE slot_cita
      SET estado = 'disponible'
      WHERE id_slot = OLD.id_slot
        AND estado = 'reservado'
        AND inicio_at > NOW();
    END IF;

    IF NEW.id_slot IS NULL THEN
      RETURN NEW;
    END IF;

    IF NEW.estado IN ('cancelada', 'rechazada') AND OLD.estado <> NEW.estado THEN
      UPDATE slot_cita
      SET estado = 'disponible'
      WHERE id_slot = NEW.id_slot
        AND estado = 'reservado'
        AND inicio_at > NOW();
    END IF;

    IF NEW.estado IN ('pendiente', 'confirmada') THEN
      UPDATE slot_cita
      SET estado = 'reservado'
      WHERE id_slot = NEW.id_slot;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION validar_reprogramacion_cancelacion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.estado IN ('pendiente', 'confirmada', 'solicitada')
     AND (
       NEW.estado IN ('cancelada', 'rechazada')
       OR NEW.inicio_at <> OLD.inicio_at
       OR NEW.fin_at <> OLD.fin_at
     )
     AND OLD.inicio_at < NOW() + INTERVAL '1 day'
     AND NOT private.es_admin()
  THEN
    RAISE EXCEPTION 'La cita solo se puede cancelar o reprogramar con minimo 1 dia de anticipacion';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, private;

CREATE INDEX IF NOT EXISTS idx_barbero_procedimiento_procedimiento
  ON barbero_procedimiento(id_procedimiento);

CREATE INDEX IF NOT EXISTS idx_cita_procedimiento_procedimiento
  ON cita_procedimiento(id_procedimiento);

REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "perfil_select_propio" ON perfil;
CREATE POLICY "perfil_select_propio"
ON perfil FOR SELECT
USING (user_id = (SELECT auth.uid()) OR (SELECT private.es_admin()));

DROP POLICY IF EXISTS "perfil_insert_propio" ON perfil;
CREATE POLICY "perfil_insert_propio"
ON perfil FOR INSERT
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "cliente_select_publico_controlado" ON cliente;
CREATE POLICY "cliente_select_publico_controlado"
ON cliente FOR SELECT
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT private.es_admin())
  OR EXISTS (
    SELECT 1
    FROM cita ci
    JOIN barbero ba ON ba.id_barbero = ci.id_barbero
    WHERE ci.id_cliente = cliente.id_cliente
      AND ba.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "cliente_insert_propio" ON cliente;
CREATE POLICY "cliente_insert_propio"
ON cliente FOR INSERT
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "cliente_update_propio" ON cliente;
CREATE POLICY "cliente_update_propio"
ON cliente FOR UPDATE
USING (user_id = (SELECT auth.uid()) OR (SELECT private.es_admin()))
WITH CHECK (user_id = (SELECT auth.uid()) OR (SELECT private.es_admin()));

DROP POLICY IF EXISTS "barbero_select_activos" ON barbero;
CREATE POLICY "barbero_select_activos"
ON barbero FOR SELECT
USING (activo = TRUE OR user_id = (SELECT auth.uid()) OR (SELECT private.es_admin()));

DROP POLICY IF EXISTS "barbero_update_propio" ON barbero;
CREATE POLICY "barbero_update_propio"
ON barbero FOR UPDATE
USING (user_id = (SELECT auth.uid()) OR (SELECT private.es_admin()))
WITH CHECK (user_id = (SELECT auth.uid()) OR (SELECT private.es_admin()));

DROP POLICY IF EXISTS "slot_select_disponibles_o_propios" ON slot_cita;
CREATE POLICY "slot_select_disponibles_o_propios"
ON slot_cita FOR SELECT
USING (
  (estado = 'disponible' AND inicio_at >= NOW())
  OR (SELECT private.es_admin())
  OR EXISTS (
    SELECT 1
    FROM barbero ba
    WHERE ba.id_barbero = slot_cita.id_barbero
      AND ba.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "slot_insert_barbero" ON slot_cita;
CREATE POLICY "slot_insert_barbero"
ON slot_cita FOR INSERT
WITH CHECK (
  (SELECT private.es_admin())
  OR EXISTS (
    SELECT 1
    FROM barbero ba
    WHERE ba.id_barbero = slot_cita.id_barbero
      AND ba.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "slot_update_barbero" ON slot_cita;
CREATE POLICY "slot_update_barbero"
ON slot_cita FOR UPDATE
USING (
  (SELECT private.es_admin())
  OR EXISTS (
    SELECT 1
    FROM barbero ba
    WHERE ba.id_barbero = slot_cita.id_barbero
      AND ba.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  (SELECT private.es_admin())
  OR EXISTS (
    SELECT 1
    FROM barbero ba
    WHERE ba.id_barbero = slot_cita.id_barbero
      AND ba.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "cita_select_participantes" ON cita;
CREATE POLICY "cita_select_participantes"
ON cita FOR SELECT
USING (
  (SELECT private.es_admin())
  OR EXISTS (
    SELECT 1
    FROM cliente cl
    WHERE cl.id_cliente = cita.id_cliente
      AND cl.user_id = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM barbero ba
    WHERE ba.id_barbero = cita.id_barbero
      AND ba.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "cita_insert_cliente" ON cita;
CREATE POLICY "cita_insert_cliente"
ON cita FOR INSERT
WITH CHECK (
  (SELECT private.es_admin())
  OR EXISTS (
    SELECT 1
    FROM cliente cl
    WHERE cl.id_cliente = cita.id_cliente
      AND cl.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "cita_update_participantes" ON cita;
CREATE POLICY "cita_update_participantes"
ON cita FOR UPDATE
USING (
  (SELECT private.es_admin())
  OR EXISTS (
    SELECT 1
    FROM cliente cl
    WHERE cl.id_cliente = cita.id_cliente
      AND cl.user_id = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM barbero ba
    WHERE ba.id_barbero = cita.id_barbero
      AND ba.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  (SELECT private.es_admin())
  OR EXISTS (
    SELECT 1
    FROM cliente cl
    WHERE cl.id_cliente = cita.id_cliente
      AND cl.user_id = (SELECT auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM barbero ba
    WHERE ba.id_barbero = cita.id_barbero
      AND ba.user_id = (SELECT auth.uid())
  )
);
