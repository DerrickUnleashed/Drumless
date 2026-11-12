import numpy as np

from drumless.click_track import build_beat_times


def test_beat_grid_spans_full_duration():
    times = build_beat_times(duration_s=180.0, bpm=120.0, first_beat=0.3)
    assert len(times) > 300
    assert times[0] == 0.3
    assert times[-1] < 180.0
    assert np.allclose(np.diff(times), 0.5)


def test_beat_grid_preserves_phase_for_half_and_double():
    half = build_beat_times(duration_s=10.0, bpm=60.0, first_beat=0.1)
    double = build_beat_times(duration_s=10.0, bpm=240.0, first_beat=0.1)
    assert half[0] == 0.1
    assert double[0] == 0.1


def test_beat_grid_defaults_to_zero_phase():
    times = build_beat_times(duration_s=2.0, bpm=120.0, first_beat=None)
    assert times[0] == 0.0
