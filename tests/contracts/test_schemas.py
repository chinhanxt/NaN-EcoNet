"""
Inter-Subsystem Contract Tests using JSON Schema Validation.
Validates payloads exchanged between Citizen App, Collection Engine, and Enterprise BI.
Strict compliance with JSON Schema Draft-07 specifications.
"""
import json
import os
import pytest
from jsonschema import validate, ValidationError, Draft7Validator

SCHEMAS_DIR = os.path.join(os.path.dirname(__file__), "../../schemas/v1")

@pytest.fixture
def bulky_order_schema():
    schema_path = os.path.join(SCHEMAS_DIR, "bulky_order.schema.json")
    with open(schema_path, "r", encoding="utf-8") as f:
        return json.load(f)

@pytest.fixture
def eco_reward_schema():
    schema_path = os.path.join(SCHEMAS_DIR, "eco_reward.schema.json")
    with open(schema_path, "r", encoding="utf-8") as f:
        return json.load(f)

def test_schema_draft_07_validity(bulky_order_schema, eco_reward_schema):
    """Verify that both schema files are themselves valid Draft-07 schemas."""
    Draft7Validator.check_schema(bulky_order_schema)
    Draft7Validator.check_schema(eco_reward_schema)
    assert bulky_order_schema["$schema"] == "http://json-schema.org/draft-07/schema#"
    assert eco_reward_schema["$schema"] == "http://json-schema.org/draft-07/schema#"
    assert bulky_order_schema["$id"] == "https://nan-econet.org/schemas/v1/bulky_order.json"
    assert eco_reward_schema["$id"] == "https://nan-econet.org/schemas/v1/eco_reward.json"

def test_valid_bulky_order_payload(bulky_order_schema):
    sample_payload = {
        "order_id": "ORD-2026-HCM-00129",
        "version": "1.0.0",
        "customer_id": "CITIZEN-8842",
        "pickup_location": {
            "lat": 10.7769,
            "lng": 106.7009,
            "address": "128/4 Pasteur, Ben Nghe, District 1, HCMC",
            "is_alley": True,
            "alley_depth_meters": 65
        },
        "items": [
            {
                "item_id": "ITEM-01",
                "category": "SOFA",
                "volume_m3": 1.45,
                "weight_kg": 42.0,
                "material_breakdown": {
                    "wood_ratio": 0.40,
                    "foam_ratio": 0.50,
                    "metal_ratio": 0.10
                }
            }
        ],
        "pricing": {
            "base_fee": 150000,
            "volume_fee": 120000,
            "floor_surcharge": 0,
            "alley_surcharge": 30000,
            "total_vnd": 300000,
            "locked_until_epoch": 1790435400
        },
        "time_window": {
            "earliest": "2026-09-27T08:00:00+07:00",
            "latest": "2026-09-27T10:00:00+07:00"
        }
    }
    # Should validate without throwing ValidationError
    validate(instance=sample_payload, schema=bulky_order_schema)

def test_invalid_bulky_order_payload_fails(bulky_order_schema):
    invalid_payload = {
        "order_id": "ORD-INVALID",
        # Missing version and pricing
        "customer_id": "CITIZEN-000"
    }
    with pytest.raises(ValidationError):
        validate(instance=invalid_payload, schema=bulky_order_schema)

def test_bulky_order_invalid_coordinates(bulky_order_schema):
    invalid_payload = {
        "order_id": "ORD-2026-HCM-00130",
        "version": "1.0.0",
        "customer_id": "CITIZEN-8842",
        "pickup_location": {
            "lat": 195.5,  # Out of range [-90, 90]
            "lng": 106.7009,
            "address": "Invalid Lat St",
            "is_alley": False,
            "alley_depth_meters": 0
        },
        "items": [
            {
                "item_id": "ITEM-02",
                "category": "TABLE",
                "volume_m3": 0.8,
                "weight_kg": 15.0,
                "material_breakdown": {"wood_ratio": 1.0}
            }
        ],
        "pricing": {
            "base_fee": 100000,
            "volume_fee": 0,
            "floor_surcharge": 0,
            "alley_surcharge": 0,
            "total_vnd": 100000,
            "locked_until_epoch": 1790435400
        },
        "time_window": {
            "earliest": "2026-09-27T08:00:00+07:00",
            "latest": "2026-09-27T10:00:00+07:00"
        }
    }
    with pytest.raises(ValidationError):
        validate(instance=invalid_payload, schema=bulky_order_schema)

def test_bulky_order_negative_pricing_fails(bulky_order_schema):
    invalid_payload = {
        "order_id": "ORD-2026-HCM-00131",
        "version": "1.0.0",
        "customer_id": "CITIZEN-8842",
        "pickup_location": {
            "lat": 10.7769,
            "lng": 106.7009,
            "address": "128/4 Pasteur, D1",
            "is_alley": False,
            "alley_depth_meters": 0
        },
        "items": [
            {
                "item_id": "ITEM-03",
                "category": "CABINET",
                "volume_m3": 1.0,
                "weight_kg": 30.0,
                "material_breakdown": {"wood_ratio": 0.8}
            }
        ],
        "pricing": {
            "base_fee": -50000,  # Negative pricing invalid
            "volume_fee": 0,
            "floor_surcharge": 0,
            "alley_surcharge": 0,
            "total_vnd": -50000,
            "locked_until_epoch": 1790435400
        },
        "time_window": {
            "earliest": "2026-09-27T08:00:00+07:00",
            "latest": "2026-09-27T10:00:00+07:00"
        }
    }
    with pytest.raises(ValidationError):
        validate(instance=invalid_payload, schema=bulky_order_schema)

def test_bulky_order_empty_items_fails(bulky_order_schema):
    invalid_payload = {
        "order_id": "ORD-2026-HCM-00132",
        "version": "1.0.0",
        "customer_id": "CITIZEN-8842",
        "pickup_location": {
            "lat": 10.7769,
            "lng": 106.7009,
            "address": "128/4 Pasteur, D1",
            "is_alley": False,
            "alley_depth_meters": 0
        },
        "items": [],  # Empty items array violates minItems: 1
        "pricing": {
            "base_fee": 0,
            "volume_fee": 0,
            "floor_surcharge": 0,
            "alley_surcharge": 0,
            "total_vnd": 0,
            "locked_until_epoch": 1790435400
        },
        "time_window": {
            "earliest": "2026-09-27T08:00:00+07:00",
            "latest": "2026-09-27T10:00:00+07:00"
        }
    }
    with pytest.raises(ValidationError):
        validate(instance=invalid_payload, schema=bulky_order_schema)

def test_valid_eco_reward_payload(eco_reward_schema):
    sample_reward = {
        "transaction_id": "TX-EPR-2026-9912",
        "version": "1.0.0",
        "order_id": "ORD-2026-HCM-00129",
        "citizen_id": "CITIZEN-8842",
        "fmcg_partner_id": "FMCG-UNILEVER-VN",
        "epr_material_category": "RIGID_PLASTIC_PET",
        "weight_verified_kg": 14.8,
        "voucher_issued": {
            "code": "HIGHLANDS-ECO-20K-8812",
            "brand": "Highlands Coffee",
            "discount_value": 20000,
            "expiry_iso": "2026-10-31T23:59:59+07:00"
        },
        "audit_trail": {
            "gps_lat": 10.7769,
            "gps_lng": 106.7009,
            "collected_at_iso": "2026-09-27T08:45:10+07:00",
            "one_time_burn_token": "a4f89d31-9921-4f11-9e23-89912781ccf2"
        }
    }
    validate(instance=sample_reward, schema=eco_reward_schema)

def test_invalid_eco_reward_missing_audit_trail(eco_reward_schema):
    invalid_reward = {
        "transaction_id": "TX-EPR-2026-9913",
        "version": "1.0.0",
        "order_id": "ORD-2026-HCM-00129",
        "citizen_id": "CITIZEN-8842",
        "fmcg_partner_id": "FMCG-UNILEVER-VN",
        "epr_material_category": "RIGID_PLASTIC_PET",
        "weight_verified_kg": 10.0,
        "voucher_issued": {
            "code": "VOUCHER-10K",
            "brand": "Cafeteria",
            "discount_value": 10000,
            "expiry_iso": "2026-10-31T23:59:59+07:00"
        }
        # Missing audit_trail
    }
    with pytest.raises(ValidationError):
        validate(instance=invalid_reward, schema=eco_reward_schema)

def test_invalid_eco_reward_unsupported_category(eco_reward_schema):
    invalid_reward = {
        "transaction_id": "TX-EPR-2026-9914",
        "version": "1.0.0",
        "order_id": "ORD-2026-HCM-00129",
        "citizen_id": "CITIZEN-8842",
        "fmcg_partner_id": "FMCG-UNILEVER-VN",
        "epr_material_category": "RADIOACTIVE_URANIUM",  # Not in allowed enum
        "weight_verified_kg": 5.0,
        "voucher_issued": {
            "code": "VOUCHER-5K",
            "brand": "Cafeteria",
            "discount_value": 5000,
            "expiry_iso": "2026-10-31T23:59:59+07:00"
        },
        "audit_trail": {
            "gps_lat": 10.7769,
            "gps_lng": 106.7009,
            "collected_at_iso": "2026-09-27T08:45:10+07:00",
            "one_time_burn_token": "token-xyz"
        }
    }
    with pytest.raises(ValidationError):
        validate(instance=invalid_reward, schema=eco_reward_schema)

def test_invalid_eco_reward_negative_weight(eco_reward_schema):
    invalid_reward = {
        "transaction_id": "TX-EPR-2026-9915",
        "version": "1.0.0",
        "order_id": "ORD-2026-HCM-00129",
        "citizen_id": "CITIZEN-8842",
        "fmcg_partner_id": "FMCG-UNILEVER-VN",
        "epr_material_category": "ALUMINUM_CAN",
        "weight_verified_kg": -2.5,  # Negative weight invalid
        "voucher_issued": {
            "code": "VOUCHER-5K",
            "brand": "Cafeteria",
            "discount_value": 5000,
            "expiry_iso": "2026-10-31T23:59:59+07:00"
        },
        "audit_trail": {
            "gps_lat": 10.7769,
            "gps_lng": 106.7009,
            "collected_at_iso": "2026-09-27T08:45:10+07:00",
            "one_time_burn_token": "token-xyz"
        }
    }
    with pytest.raises(ValidationError):
        validate(instance=invalid_reward, schema=eco_reward_schema)
