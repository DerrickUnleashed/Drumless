import numpy as np

from drumless.tempo import first_beat_time


def test_first_beat_time_returns_first_timestamp():
    assert first_beat_time(np.array([0.42, 0.92, 1.42])) == 0.42


def test_first_beat_time_returns_zero_when_empty():
    assert first_beat_time(np.array([])) == 0.0
