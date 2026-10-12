-- Prevent browser/anon clients from reading or writing participant submissions,
-- test results, and drafts. Server routes use the service-role client.

DROP POLICY IF EXISTS "Allow anon all coding_submissions"
ON public.coding_submissions;
DROP POLICY IF EXISTS "Allow anon all coding_test_results"
ON public.coding_test_results;
DROP POLICY IF EXISTS "Allow anon all coding_drafts"
ON public.coding_drafts;

REVOKE ALL ON TABLE public.coding_submissions FROM anon, authenticated;
REVOKE ALL ON TABLE public.coding_test_results FROM anon, authenticated;
REVOKE ALL ON TABLE public.coding_drafts FROM anon, authenticated;
GRANT ALL ON TABLE public.coding_submissions TO service_role;
GRANT ALL ON TABLE public.coding_test_results TO service_role;
GRANT ALL ON TABLE public.coding_drafts TO service_role;

CREATE POLICY "Deny direct coding submission access"
ON public.coding_submissions
FOR ALL
USING (false)
WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.finalize_coding_submission(
  p_submission_id UUID,
  p_status TEXT,
  p_score INTEGER,
  p_passed_tests INTEGER,
  p_total_tests INTEGER,
  p_execution_time_ms INTEGER,
  p_stdout TEXT,
  p_stderr TEXT,
  p_error_message TEXT,
  p_completed_at TIMESTAMPTZ,
  p_test_results JSONB
)
RETURNS public.coding_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_submission public.coding_submissions;
  v_result JSONB;
BEGIN
  SELECT *
  INTO v_submission
  FROM public.coding_submissions
  WHERE id = p_submission_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  IF v_submission.status IN ('completed', 'failed', 'timeout', 'system_error') THEN
    RETURN v_submission;
  END IF;

  IF p_status NOT IN ('completed', 'failed', 'timeout', 'system_error')
     OR p_score < 0
     OR p_score > v_submission.max_score
     OR p_passed_tests < 0
     OR p_total_tests < 0
     OR p_passed_tests > p_total_tests
     OR jsonb_typeof(p_test_results) <> 'array' THEN
    RAISE EXCEPTION 'Invalid submission finalization';
  END IF;

  UPDATE public.coding_submissions
  SET status = p_status,
      score = p_score,
      passed_tests = p_passed_tests,
      total_tests = p_total_tests,
      execution_time_ms = p_execution_time_ms,
      stdout = p_stdout,
      stderr = p_stderr,
      error_message = p_error_message,
      completed_at = p_completed_at
  WHERE id = p_submission_id
  RETURNING * INTO v_submission;

  FOR v_result IN SELECT value FROM jsonb_array_elements(p_test_results)
  LOOP
    INSERT INTO public.coding_test_results (
      submission_id,
      test_type,
      test_number,
      test_name,
      passed,
      execution_time_ms,
      error_message
    )
    VALUES (
      p_submission_id,
      v_result->>'test_type',
      (v_result->>'test_number')::INTEGER,
      v_result->>'test_name',
      (v_result->>'passed')::BOOLEAN,
      COALESCE((v_result->>'execution_time_ms')::INTEGER, 0),
      v_result->>'error_message'
    );
  END LOOP;

  RETURN v_submission;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_coding_submission(
  UUID, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_coding_submission(
  UUID, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ, JSONB
) TO service_role;

CREATE POLICY "Deny direct coding test result access"
ON public.coding_test_results
FOR ALL
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny direct coding draft access"
ON public.coding_drafts
FOR ALL
USING (false)
WITH CHECK (false);
