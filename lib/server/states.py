from enum import Enum, unique

@unique
class State(Enum):
    ERROR = 0
    INITIALIZING = 1
    TRANSCRIBING = 2
    INFERENCE_TXT_A = 3
    INFERENCE_TXT_B = 4
    INFERENCE_IMG_A = 5
    INFERENCE_IMG_B = 6
    REVIEW_TXT = 7
    REVIEW_IMG = 8
    SELECT_A_TXT = 9
    SELECT_A_IMG = 10
    SELECT_B_TXT = 11
    SELECT_B_IMG = 12