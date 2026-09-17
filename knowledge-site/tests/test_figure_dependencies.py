import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import render_figures


class FigureDependenciesTest(unittest.TestCase):
    def test_replacing_graphic_invalidates_render_cache(self):
        with patch.object(Path, 'read_text', return_value=''), patch.object(
                Path, 'read_bytes', side_effect=[b'first', b'first', b'revised']):
            records = [{'content': r'\includegraphics[width=\textwidth]{plot.pdf}'}]
            before = render_figures.records_hash(records)
            self.assertEqual(before, render_figures.records_hash(records))
            self.assertNotEqual(before, render_figures.records_hash(records))


if __name__ == '__main__':
    unittest.main()
