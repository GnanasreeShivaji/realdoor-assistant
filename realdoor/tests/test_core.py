from utils.rules_engine import ABSTENTION, annualize, answer_rule_question
from utils.readiness import assess_readiness


def test_annualize_biweekly():
    value, formula = annualize(2166, "biweekly")
    assert value == 56316
    assert "26" in formula


def test_decision_request_is_refused():
    answer = answer_rule_question("Should I approve this applicant as eligible?")
    assert answer.abstained
    assert "cannot determine" in answer.answer


def test_unsupported_rule_abstains():
    answer = answer_rule_question("What is the applicant's favorite color?")
    assert answer.abstained
    assert answer.answer == ABSTENTION


def test_readiness_is_completeness_only():
    result = assess_readiness([{"document_type": "pay_stub"}])
    assert result["score"] < 100
    assert "does not indicate eligibility" in result["disclaimer"]

