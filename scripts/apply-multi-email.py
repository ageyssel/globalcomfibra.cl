from pathlib import Path

ADMIN_FILE = Path('admin.html')
SCRIPT_TAG = '    <script src="admin-multi-email.js?v=20260731"></script>\n'


def main() -> None:
    content = ADMIN_FILE.read_text(encoding='utf-8')

    if 'admin-multi-email.js' in content:
        print('admin.html ya contiene el módulo multi-email.')
        return

    closing_body = '</body>'
    if closing_body not in content:
        raise SystemExit('No se encontró </body> en admin.html')

    content = content.replace(closing_body, f'{SCRIPT_TAG}{closing_body}', 1)
    ADMIN_FILE.write_text(content, encoding='utf-8')
    print('Módulo multi-email enlazado en admin.html.')


if __name__ == '__main__':
    main()
