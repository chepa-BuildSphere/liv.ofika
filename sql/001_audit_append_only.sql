-- Ofika Delivery — protections au niveau de la base de données
-- À exécuter APRÈS la première migration Drizzle.
-- Drizzle ne sait pas déclarer les triggers : ce fichier s'applique à part
-- (ou se copie dans une migration personnalisée : npx drizzle-kit generate --custom).

-- 1. Journal d'audit en ajout seul : aucune modification, aucune suppression.
CREATE OR REPLACE FUNCTION forbid_audit_change() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events est en ajout seul : % interdit', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_events_no_update ON audit_events;
CREATE TRIGGER audit_events_no_update
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_change();

DROP TRIGGER IF EXISTS audit_events_no_truncate ON audit_events;
CREATE TRIGGER audit_events_no_truncate
  BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_audit_change();

-- 2. Une livraison livrée ou un retour réceptionné est verrouillé :
--    son statut ne peut plus changer.
CREATE OR REPLACE FUNCTION forbid_locked_delivery_change() RETURNS trigger AS $$
BEGIN
  IF OLD.status IN ('DELIVERED', 'RETURN_RECEIVED') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Livraison % verrouillée (statut %)', OLD.id, OLD.status;
  END IF;
  IF OLD.billed_price IS NOT NULL AND NEW.billed_price IS DISTINCT FROM OLD.billed_price THEN
    RAISE EXCEPTION 'Prix facturé figé pour la livraison %', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deliveries_locked ON deliveries;
CREATE TRIGGER deliveries_locked
  BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION forbid_locked_delivery_change();

-- 3. Une livraison de test n'est jamais facturée, et ne change jamais de mode.
CREATE OR REPLACE FUNCTION forbid_test_billing() RETURNS trigger AS $$
BEGIN
  IF NEW.is_test AND NEW.billed_price IS NOT NULL THEN
    RAISE EXCEPTION 'Une livraison de test ne peut pas être facturée (%)', NEW.id;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.is_test IS DISTINCT FROM OLD.is_test THEN
    RAISE EXCEPTION 'Le mode test d''une livraison ne peut pas changer (%)', NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deliveries_test_not_billed ON deliveries;
CREATE TRIGGER deliveries_test_not_billed
  BEFORE INSERT OR UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION forbid_test_billing();

-- 4. Interrupteurs de départ : OTP en maintenance.
INSERT INTO feature_flags (key, enabled) VALUES ('otp_enabled', false)
  ON CONFLICT (key) DO NOTHING;
