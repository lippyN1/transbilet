
import sqlite3
from pathlib import Path

DB_PATH = Path("waygo.db")

if not DB_PATH.exists():
    print(f"ОШИБКА: файл БД не найден: {DB_PATH.resolve()}")
    raise SystemExit(1)

try:
    with sqlite3.connect(
        f"file:{DB_PATH.resolve().as_posix()}?mode=ro",
        uri=True,
        timeout=5
    ) as conn:
        # 1. Проверяем целостность файла БД
        result = conn.execute("PRAGMA integrity_check").fetchone()[0]
        print("Целостность:", result)

        # 2. Выводим все таблицы
        tables = conn.execute("""
            SELECT name
            FROM sqlite_master
            WHERE type = 'table'
            ORDER BY name
        """).fetchall()

        print("\nТаблицы:")
        for (table_name,) in tables:
            print("-", table_name)

        # 3. Проверяем количество записей в каждой таблице
        print("\nКоличество записей:")
        for (table_name,) in tables:
            # Имя берётся из системного каталога SQLite
            safe_name = '"' + table_name.replace('"', '""') + '"'
            count = conn.execute(
                f"SELECT COUNT(*) FROM {safe_name}"
            ).fetchone()[0]
            print(f"{table_name}: {count}")

except sqlite3.Error as error:
    print("ОШИБКА SQLite:", error)
