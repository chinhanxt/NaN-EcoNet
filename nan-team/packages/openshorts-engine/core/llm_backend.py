"""All text selection uses the authenticated parent process's native AGY MCP."""
import ai_provider


def active():
    return True


def model_name():
    return 'agy-mcp'


def describe():
    return {'provider': 'agy-mcp', 'model': model_name()}


def generate_json(prompt, schema, model=None, **kwargs):
    data = ai_provider.current().request(prompt, schema.model_json_schema())
    return schema.model_validate(data).model_dump(), None


def base_url():
    # Upstream moment picker logs this compatibility attribute; no HTTP transport exists.
    return 'native-job-rpc://agy-mcp'
