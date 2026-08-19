from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path

from veinguard_sim.settings import get_settings

EPA_NET3_ID = "epa-net3"
EPA_NET3_SHA256 = "ea3e825c4fef0b5cba47fb06301bc85253f18b6364dc96c44d9fb492c40faa52"


@dataclass(frozen=True)
class CatalogNetwork:
    network_id: str
    name: str
    source_type: str
    inp_path: Path
    expected_sha256: str | None


def networks_dir() -> Path:
    configured = Path(get_settings().network_data_dir)
    if not configured.is_absolute():
        from_cwd = (Path.cwd() / configured).resolve()
        if from_cwd.exists():
            return from_cwd
        repo_root = Path(__file__).resolve().parents[3]
        return (repo_root / "data" / "networks").resolve()
    return configured


def catalog_networks() -> dict[str, CatalogNetwork]:
    root = networks_dir()
    net3 = root / "epa-net3" / "Net3.inp"
    return {
        EPA_NET3_ID: CatalogNetwork(
            network_id=EPA_NET3_ID,
            name="EPA Net3 Benchmark",
            source_type="EPA_BENCHMARK",
            inp_path=net3,
            expected_sha256=EPA_NET3_SHA256,
        )
    }


def sha256_bytes(data: bytes) -> str:
    return sha256(data).hexdigest()


def load_catalog_bytes(network_id: str) -> tuple[CatalogNetwork, bytes]:
    networks = catalog_networks()
    network = networks.get(network_id)
    if network is None:
        known = ", ".join(sorted(networks))
        msg = f"Unknown networkId '{network_id}'. Known: {known}."
        raise FileNotFoundError(msg)
    if not network.inp_path.is_file():
        msg = f"Network file missing: {network.inp_path}"
        raise FileNotFoundError(msg)
    data = network.inp_path.read_bytes()
    digest = sha256_bytes(data)
    if network.expected_sha256 and digest != network.expected_sha256:
        msg = (
            f"SHA-256 mismatch for {network.network_id}: "
            f"expected {network.expected_sha256}, got {digest}."
        )
        raise ValueError(msg)
    return network, data
