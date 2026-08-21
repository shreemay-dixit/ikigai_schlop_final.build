"""
Backward-compatibility training script pointing to ml/train.py
"""
import os
import sys

project_root = os.path.dirname(os.path.abspath(__file__))
ml_dir = os.path.join(project_root, "ml")
if ml_dir not in sys.path:
    sys.path.insert(0, ml_dir)

import train
