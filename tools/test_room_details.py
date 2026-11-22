"""Checks how the community prayer room list becomes places. python3 tools/test_room_details.py"""
import importlib.util, pathlib
spec = importlib.util.spec_from_file_location("b", pathlib.Path(__file__).parent / "build_masjid_list.py")
b = importlib.util.module_from_spec(spec); spec.loader.exec_module(b)

room = {"type": "Musolla", "uuid": "abc", "name": "Test Mall", "address": "1 Road", "level": "B2",
        "directions": "Near the EV ports", "mrt": "Pasir Ris", "provision": "Prayer Mat", "femaleCapacity": 3,
        "unisexCapacity": 4, "sharedCapacity": 2, "location": {"latitude": 1.3, "longitude": 103.9}}
row = b.musolla_db_places({"abc": room})[0]
assert row[4] == "1 Road, B2", row  # old apps still see the floor
d = row[8]
assert d["f"] == "Near the EV ports" and d["m"] == "Pasir Ris" and "l" not in d
assert d["c"] == "women 3, shared 4", d  # one shared group only
bare = b.musolla_db_places({"x": {"type": "Musolla", "name": "Plain", "location": {"latitude": 1.3, "longitude": 103.9}}})[0]
assert len(bare) == 6, bare
print("room details OK")
