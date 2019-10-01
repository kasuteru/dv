# -*- coding: utf-8 -*-
"""
Created on Wed Sep 25 16:32:27 2019

@author: Thomas Kastl
"""

import json
import gzip
import pandas as pd
from collections import namedtuple
import os
import glob
import math

import plotly.graph_objects as go

def convert_size(size_bytes):
   if size_bytes == 0:
       return "0B"
   size_name = ("B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB")
   i = int(math.floor(math.log(size_bytes, 1024)))
   p = math.pow(1024, i)
   s = round(size_bytes / p, 1)
   return "%s %s" % (s, size_name[i])

def get_most_recent_json_log(path_logs):
    # Get most recent logs folder:
    try:
        path_logs_folder = max(glob.glob(os.path.join(path_logs, '*/')),
                               key=os.path.getmtime)
    except ValueError as e:
        raise Exception("Error with the path provided: Either not a path or"+\
                        "path does not contain subfolders!") from e
    
    # Grab path to zipped log file and test:
    path_zipped_json = os.path.join(path_logs_folder, "scan.json")
    
    if not os.path.isfile(path_zipped_json):
        raise ValueError("Most recent folder does not contain logfile. \n"+\
                         "Maybe indexing not finished / crashed?")
    return path_zipped_json

def read_json_log_to_dataframe(path_logs, maxlevels=None):
    path_zipped_json = get_most_recent_json_log(path_logs)
    
    with gzip.open(path_zipped_json) as file:
        jsonfile = json.load(file)
    
    # Slightly complicated way to extract the root folder from the indexing 
    # algorithm's output. Necessary since dict's aren't indexed.
    headnode = [node for node in jsonfile["root"]["children"].values()][0]
    
    # Keeping and updating lists of namedtuple is significantly faster than building
    # the final pandas dataframe during recursion:
    FolderEntry = namedtuple("FolderEntry", ["parentpath", "abspath", 
                                             "name", "size", "count", "level"])
    
    # Recursive function crawls all possible folder paths:
    def getIndices(node, parentpath, parentlevel):
        # Collect info about this folder:
        abspath = parentpath + "/" + node["name"]
        level = parentlevel+1
        folder_entry = FolderEntry(parentpath, 
                                   abspath, 
                                   node["name"], 
                                   node["size"],
                                   node["count"],
                                   level)
        
        # Recursively collect info about subfolders:
        subfolder_lists = [getIndices(subnode, abspath, level) for subnode in node["children"].values()]
        
        # Each getIndices returns a list. subfolder_entries is therefore a list
        # of lists and needs to be flattened:
        # (See https://stackoverflow.com/a/952952/4629950)
        subfolder_entries = [item for sublist in subfolder_lists for item in sublist]
        
        # Add this folder to subfolder and return the result upwards:
        subfolder_entries.append(folder_entry)
        return subfolder_entries
    
    list_of_entries = getIndices(headnode, "", 0)
    df = pd.DataFrame(list_of_entries)
    
    # Filter maximum levels if set to reduce size of output:
    if maxlevels is not None:
      df = df.query("level <= {}".format(maxlevels))
    
    # Get size strings (kB, MB, GB...) for easier reading:
    df["size_string"] = df["size"].apply(convert_size)
    return(df)


def visualize_folder_scan(save_directory, maxlevels=5, showlevels=3, agg_type="size"):
    df_data = read_json_log_to_dataframe(save_directory)
    
    # Reconstruct scan path from df:
    top_level_path = df_data.query("parentpath==''")["abspath"].iloc[0]
    
    # Collect arguments to figure constructor:
    fig_args = {
        "ids": df_data.abspath,
        "labels": df_data.name,
        "parents": df_data.parentpath,
        "values": df_data["size"],
        "hovertext": df_data.name,
        "hoverinfo": "text",
        "domain": dict(column=0),
        "branchvalues": "total",
        "textinfo": "none",
        "customdata": df_data["size_string"],
        "hovertemplate": "%{label}: %{customdata}  <extra>%{id}</extra>",
        "name": "filesize_chart",
        "maxdepth": showlevels
        }
    
    # Switch visualization to file count per folder if requested:
    if agg_type=="count":
      fig_args["values"]=df_data["count"]
      fig_args["hovertemplate"]= "%{label}: %{value} Files  <extra>%{id}</extra>"
      fig_args["customdata"]= None
      
    # Create and show figure:
    fig = go.Figure()
    fig.add_trace(go.Sunburst(**fig_args))
    fig.update_layout(margin = dict(t=40, l=0, r=0, b=0),
                      width=800, height=600,
                      title = {"text": "Disk usage visualization of {}".format(top_level_path)})
    fig.show()