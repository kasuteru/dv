import os
from setuptools import setup

setup(
    name = "dv",
    version = "0.0.7",
    author = "Thomas Kastl, Daniel Dohnalek",
    author_email = "",
    description = ("Visualize folder layout"),
    license = "MIT",
    keywords = "Disk usage visualization in Python",
    url = "",
    packages=['dv'],
    long_description="Long: TODO",
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Topic :: Utilities",
        "License :: OSI Approved :: BSD License",
    ],
    include_package_data=True,
    zip_safe=False # Necessary because otherwise html files are not included in package
)