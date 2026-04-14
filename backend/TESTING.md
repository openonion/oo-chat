# Testing Email Agent

## Test Organization

Tests are organized in the `tests/` directory:

```
tests/
├── __init__.py           # Test package initialization
├── test_memory.py        # Memory system tests (unit tests)
├── test_agent.py         # Agent functionality tests (integration tests)
├── test_cli.py           # CLI and do_* commands (unit tests)
├── test_credentials.py   # Credential handling tests
└── test_automation.py    # Daily automation (unit tests)
```

## Running Tests

### Using pytest (recommended for development)

```bash
# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_memory.py -v

# Run specific test function
pytest tests/test_memory.py::test_write_memory -v

# Run tests with coverage
pytest tests/ --cov=. --cov-report=term-missing

# Skip real API tests (tests that require API keys)
pytest tests/ -v -m "not real_api"

# Run only real API tests
pytest tests/ -v -m real_api
```

### Using tox (recommended for CI/CD)

```bash
# Run tests in default Python environment
tox

# Run tests in specific Python version
tox -e py39
tox -e py310
tox -e py311

# Run only unit tests
tox -e unit

# Run with coverage report
tox -e coverage

# Run linting
tox -e lint

# Auto-format code
tox -e format
```

## Test Categories

### Unit Tests
- **Location**: `tests/*.py`
- **Purpose**: Test individual components in isolation
- **Speed**: Fast (< 1 second)
- **Dependencies**: None (no external services)

Example:
```bash
\pytest tests/*.py -v
```

### Integration Tests
- **Location**: `tests/test_agent.py`
- **Purpose**: Test agent with tools integration
- **Speed**: Medium (10-20 seconds)
- **Dependencies**: ConnectOnion framework

Example:
```bash
pytest tests/test_agent.py -v
```

### Real API Tests
- **Marker**: `@pytest.mark.real_api`
- **Purpose**: Test with actual LLM API calls
- **Speed**: Slow (20+ seconds)
- **Dependencies**: API keys required

Example:
```bash
pytest tests/ -v -m real_api
```

## Writing Tests

### Test File Structure

Each test file should follow this pattern:

```python
"""Test description."""

import pytest
from agent import Memory  # Import what you're testing

@pytest.fixture
def test_memory():
    """Create test fixture with cleanup."""
    # Setup
    memory = Memory(memory_dir="test_dir")
    yield memory
    # Teardown
    cleanup()

def test_feature_name():
    """Test description."""
    # Arrange
    setup_data()

    # Act
    result = function_to_test()

    # Assert
    assert result == expected
```

### Test Naming Convention

- Test files: `test_*.py`
- Test functions: `test_*`
- Test classes: `Test*`
- Fixtures: descriptive names (e.g., `test_memory`, `mock_llm`)

### Best Practices

1. **One assertion per test** (when possible)
2. **Use descriptive test names** that explain what's being tested
3. **Follow AAA pattern**: Arrange, Act, Assert
4. **Clean up after tests** using fixtures or try/finally
5. **Mock external dependencies** for unit tests
6. **Mark tests appropriately** (unit, integration, real_api)

### Adding New Tests

1. Create test file in `tests/` directory:
   ```bash
   touch tests/test_new_feature.py
   ```

2. Write test functions:
   ```python
   def test_new_feature():
       """Test that new feature works correctly."""
       result = new_feature()
       assert result is not None
   ```

3. Run the tests:
   ```bash
   pytest tests/test_new_feature.py -v
   ```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: [3.9, 3.10, 3.11, 3.12]

    steps:
    - uses: actions/checkout@v2
    - name: Set up Python
      uses: actions/setup-python@v2
      with:
        python-version: ${{ matrix.python-version }}

    - name: Install dependencies
      run: |
        pip install tox tox-gh-actions

    - name: Run tests
      run: tox
```

## Test Coverage

Check test coverage to ensure all code paths are tested:

```bash
# Generate coverage report
pytest --cov=. --cov-report=html

# View HTML report
open htmlcov/index.html
```

## Troubleshooting

### Tests fail with "ModuleNotFoundError"
```bash
# Ensure PYTHONPATH is set
export PYTHONPATH=$PWD
pytest tests/
```

### Tox can't find Python version
```bash
# Install required Python versions with pyenv
pyenv install 3.9.7
pyenv install 3.10.0
pyenv install 3.11.0
```

### Tests hang or timeout
```bash
# Increase timeout in tox.ini
[testenv]
timeout = 300
```

## Quick Reference

```bash
# Fast feedback loop (development)
pytest tests/test_memory.py -v

# Full test suite
tox

# With coverage
tox -e coverage

# Format code before committing
tox -e format

# Check code quality
tox -e lint
```

## Resources

- [pytest documentation](https://docs.pytest.org/)
- [tox documentation](https://tox.wiki/)
- [ConnectOnion testing guide](https://docs.connectonion.com/testing)
