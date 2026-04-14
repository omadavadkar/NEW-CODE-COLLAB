from collections import defaultdict
from threading import Lock


class RoomStore:
    def __init__(self):
        self._rooms = defaultdict(dict)
        self._lock = Lock()

    def join_user(self, room_id: str, sid: str, username: str) -> list[dict]:
        with self._lock:
            self._rooms[room_id][sid] = username
            return [
                {'sid': member_sid, 'username': member_name}
                for member_sid, member_name in self._rooms[room_id].items()
            ]

    def leave_user(self, room_id: str, sid: str) -> tuple[str | None, list[dict]]:
        with self._lock:
            username = self._rooms[room_id].pop(sid, None)
            users = [
                {'sid': member_sid, 'username': member_name}
                for member_sid, member_name in self._rooms[room_id].items()
            ]
            if not self._rooms[room_id]:
                self._rooms.pop(room_id, None)
            return username, users

    def get_users(self, room_id: str) -> list[str]:
        with self._lock:
            return list(self._rooms[room_id].values())

    def get_users_detailed(self, room_id: str) -> list[dict]:
        with self._lock:
            return [
                {'sid': member_sid, 'username': member_name}
                for member_sid, member_name in self._rooms[room_id].items()
            ]

    def has_user(self, room_id: str, sid: str) -> bool:
        with self._lock:
            return sid in self._rooms[room_id]

    def get_username(self, room_id: str, sid: str) -> str | None:
        with self._lock:
            return self._rooms[room_id].get(sid)

    def get_room_ids(self) -> list[str]:
        with self._lock:
            return list(self._rooms.keys())


class CodeStore:
    def __init__(self):
        self._code_by_room = defaultdict(str)
        self._lock = Lock()

    def set_code(self, room_id: str, code: str) -> None:
        with self._lock:
            self._code_by_room[room_id] = code

    def get_code(self, room_id: str) -> str:
        with self._lock:
            return self._code_by_room[room_id]

    def delete_code(self, room_id: str) -> None:
        with self._lock:
            self._code_by_room.pop(room_id, None)
