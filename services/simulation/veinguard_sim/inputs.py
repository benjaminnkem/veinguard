from __future__ import annotations

from veinguard_sim.catalog import load_catalog_bytes, sha256_bytes
from veinguard_sim.epanet.engine import LoadedInp
from veinguard_sim.epanet.errors import NetworkInvalidError


def resolve_inp(network_id: str | None, inp_text: str | None) -> LoadedInp:
    if network_id:
        try:
            catalog, data = load_catalog_bytes(network_id)
        except FileNotFoundError as exc:
            raise NetworkInvalidError(str(exc)) from exc
        except ValueError as exc:
            raise NetworkInvalidError(str(exc)) from exc
        return LoadedInp(
            inp_bytes=data,
            sha256=sha256_bytes(data),
            network_id=catalog.network_id,
            name=catalog.name,
            source_type=catalog.source_type,
        )
    if inp_text is None or not inp_text.strip():
        raise NetworkInvalidError("Provide networkId or inpText.")
    data = inp_text.encode("utf-8")
    return LoadedInp(
        inp_bytes=data,
        sha256=sha256_bytes(data),
        network_id=None,
        name=None,
        source_type="USER_UPLOAD",
    )
