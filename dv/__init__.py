import subprocess
import sys
import os
import multiprocessing

# Relative imports are weird for packages???
if __package__ is None or __package__ == '':
    # uses current directory visibility
    import visualize
else:
    # uses current package visibility
    from . import visualize
    
# Function to call over command line:
def index_folder(directory, save_directory, depth=10):
    # Create string to parse:
    dv_file_path = os.path.join(os.path.dirname(__file__),"dv.py")
    exec_path = sys.executable
    command = [exec_path, dv_file_path, directory, 
               "--save={}".format(save_directory),
               "--depth={}".format(depth),
               "--processes={}".format(multiprocessing.cpu_count()),
               "-uv"]
    
    process = subprocess.Popen(command, stdout=subprocess.PIPE)
    for line in iter(process.stdout.readline, b''):
        sys.stdout.write(line)


def visualize_folder(save_directory, max_levels=5):
    visualize.visualize_folder_scan(save_directory,  max_levels=5)