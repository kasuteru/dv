"use strict";

var current_time = moment() / 1000;

var start_root;
var scanned_dir;
var mtime_on;
var volume_bytes;
var sep;

var fade_on;
var newest_dir;
var oldest_dir;

var prettyCount = d3.format(".3s");

var width;
var height;
var svg_size;
var svg;
var radius;
setSizes();

$(window).resize(buildVisual);

// Initialize and load settings variables
var r_hue;
var value_type;
var dark_theme;
var fs_percent;
loadSettings();
applyTheme();

// Get slider objects
var min_slider = document.getElementById("min-date-slider");
var max_slider = document.getElementById("max-date-slider");
var min_date_text = document.getElementById("min-date-limit");
var max_date_text = document.getElementById("max-date-limit");
var slider_time_unit;

var settings_shown = false;
var moved_down = false;
var total_value = 0;
var tree_depth = 0;
var json;

var colors = {};

var time_units = {
    "seconds": 1,
    "minutes": 60,
    "hours": 3600,
    "days": 3600 * 24,
    "weeks": 3600 * 24 * 7,
    "months": 3600 * 24 * 30
};

// Breadcrumb dimensions: width, height, spacing, width of tip/tail.
var b = {
    w: 70, h: 30, s: 3, t: 10, xo: 0, yo: 0
};

var tooltip = document.getElementById("tooltip");

var hue_slider = document.getElementById("hue-slider");
hue_slider.onchange = hueChange;

var loading_layer = document.getElementById("loading");
loading_layer.addEventListener("transitionend", loading_layer.remove, false);


function getColor(name, sat_ratio) {
    var color;
    if(colors[name] == undefined) {
        var hue_funct = -6 * Math.sin((r_hue - 0.3) * 2 * Math.PI) + 14;
        var sv_funct = -2 * (Math.pow(2 * (r_hue-0.15), 6) - 0.0000001)/(Math.pow(2 * (r_hue-0.15), 6) + 0.0000001) + 5;
        var hue = ((Math.random() / hue_funct - (0.5 / hue_funct) + r_hue) % 1.0) * 360;
        var sat = 50.0 * sat_ratio;
        var bright = ((0.5 + Math.random() / (sv_funct + 2) - (2/3/sv_funct))) * 100;
        color = "hsl(" + Math.floor(hue) + ", " + Math.floor(sat) + "%, " + Math.floor(bright) + "%)";
        colors[name] = color;
    } else {
        color = colors[name];
    }
    return color;
}

function prettySize(byte_count) {
    var units = ["YB", "ZB", "EB", "PB", "TB", "GB", "MB", "KB", "B"];
    for(var i = 0; i < units.length; i++) {
        var size = byte_count / Math.pow(1024, (units.length - i - 1));
        if(Math.floor(size) == 0 && units.length - 1) {
            continue;
        }
        if(size >= 100) {
            size = size.toFixed(1)
        } else {
            size = size.toFixed(2)
        }
        return size + " " + units[i];
    }
}

function getPercentString(value, total) {
    var percentage = (100 * value / total).toPrecision(3);
    var percentage_string = percentage + "%";
    if (percentage < 0.1) {
        percentage_string = "< 0.1%";
    }
    return percentage_string;
}

function updateExplanation(node) {
    var value;
    if(node == false) {
        // We moved off the circle
        value = total_value.toString();
    }
    else {
        // Hovering over a semi-circle
        value = node.getAttribute("value");
    }

    var shown_value = value;
    if(value_type == "size") {
        shown_value = prettySize(value);
    }
    else if(value_type == "count") {
        shown_value = prettyCount(shown_value);
    }
    var percentage_string = getPercentString(value, total_value);

    // Update FS percentage
    var fs_percent_string = getPercentString(value, volume_bytes);

    d3.select("#volume-percent")
        .text("(" + fs_percent_string + " of volume)");

    d3.select("#value")
        .text(shown_value);

    d3.select("#percentage")
        .text(percentage_string);

    var value_string;
    if(value_type == "size") {
        value_string = "bytes";
    }
    else if(value_type == "count") {
        value_string = "files";
    }
    d3.select("#value_type")
        .text(value_string);
}

function getBreadcrumbPoints(path_part, i) {
    var points = [];

    var bw = b.w + (path_part.length * 5);

    b.yo = 0;
    if(moved_down || b.xo + bw + b.t > width) {
        b.yo = 35;
        if(!moved_down) {
            b.xo = -b.t;
        }
        moved_down = true;
    }

    points.push(b.xo + "," + b.yo);
    points.push(b.xo + bw + "," + b.yo);
    points.push(b.xo + bw + b.t + "," + ((b.h / 2) + b.yo));
    points.push(b.xo + bw + "," + (b.h + b.yo));
    points.push(b.xo + "," + (b.h + b.yo));
    if (i > 0) { // Leftmost breadcrumb; don't include 6th vertex.
        points.push(b.xo + b.t + "," + ((b.h / 2) + b.yo));
    }

    return points.join(" ");
}

function updateBreadcrumbs(path_parts) {
    if(json == undefined) {
        return;
    }

    var trail = d3.select("#trail");
    var existing_trail = trail[0][0].childNodes;

    // Delete existing breadcrumb SVG items
    if(existing_trail != undefined) {
        b.xo = 0;
        for(var c = 0; c < existing_trail.length;) {
            existing_trail[c].remove();
        }
    }

    var path_parts = json["scanned_dir"].split(sep).slice(1).concat(path_parts.slice(1));
    // Add new breadcrumbs
    moved_down = false;
    for(var i = 0; i < path_parts.length; i++) {
        var points = getBreadcrumbPoints(path_parts[i], i);

        trail.append("svg:polygon")
            .attr("points", points)
            .attr("fill", getColor(path_parts[i], 1))
            .style("transition", "fill 1s");

        var text_x = b.xo + (b.w + b.t) / 2 + path_parts[i].length*2.5;

        trail.append("svg:text")
            .attr("x", text_x)
            .attr("y", b.h / 2 + b.yo)
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("font-size", "0.4em")
            .style("fill", "white")
            .text(path_parts[i]);

        b.xo = b.xo + b.w + (path_parts[i].length * 5) + b.s; // Tip of the current arrow + offset gets the next breadcrumb offset
    }
}

function formatDate(unix_timestamp, keep_time) {
    var date = new Date(0);
    date.setUTCSeconds(unix_timestamp);

    var date_string;
    if(keep_time) {
        date_string = date.toString().split(" ").slice(0, -2).join(" ");
    } else {
        date_string = date.getMonth() + "/" + date.getDate() + "/" + date.getFullYear();
    }
    return date_string;
}

function onClick(event) {
    var path = tooltip.innerHTML;
    if(path && tooltip.style.visibility == "visible") {
        var current_path = path.replace(scanned_dir, "");
        start_root = start_root + current_path;
        buildVisual();
    }
}

function onMouseOver(event) {
    var node_path = event.target.getAttribute("id");
    if(!node_path || node_path[0] != sep) {
        return;
    }
    var path_parts = node_path.split(sep).slice(1);
    d3.selectAll("path").style("opacity", 0.3);

    // Find parent elements by IDs and make them solid
    for(var i = 0; i < path_parts.length; i++) {
        var current_path = sep + path_parts.slice(0, i + 1).join(sep);
        document.getElementById(current_path).style.opacity = 1;
    }

    tooltip.style.visibility = "visible";
    var drill_path = sep + "root" + node_path;
    var node = drillDown(drill_path);
    tooltip.innerHTML = json["drive_letter"] + scanned_dir.split(sep).slice(0, -1).join(sep) + node_path;
    if(mtime_on) {
        tooltip.innerHTML += " - modified " + moment(node.mtime, "X").fromNow();
    }

    updateExplanation(event.target);
    updateBreadcrumbs(path_parts);
}

function onMouseLeave(event) {
    tooltip.style.visibility = "hidden";

    var paths = d3.selectAll("path")
        .each(function(d, i) {
            var node = drillDown(sep + "root" + this.id);

            d3.select(this)
                .transition()
                .duration(500)
                .style("opacity", 1);
        });

    updateExplanation(false);
    updateBreadcrumbs([])
}

function onMouseMove(event) {
    var x_offset = event.clientX + 10;
    var tooltip_width = tooltip.getClientRects()[0].width;
    if (x_offset + tooltip_width >= width) {
        x_offset -= x_offset + tooltip_width - width;
    }

    tooltip.style.top = event.clientY + 20 + "px";
    tooltip.style.left = x_offset + "px";
    nudgeToolTip();
}

function nudgeToolTip() {
    var value_element = document.getElementById("value");
    var tries = 0;

    var tooltip_rect = tooltip.getBoundingClientRect();
    var value_rect = value_element.getBoundingClientRect();

    var nudge_number = tooltip_rect.bottom - value_rect.top;
    if(nudge_number < 60) {
        nudge_number = -1;
    } else {
        nudge_number = 1;
    }

    while(collides(value_element, tooltip) || tries > 100) {
        tooltip.style.top = parseInt(tooltip.style.top, 10) + nudge_number + "px";
        tries += 1;
    }
}

function collides(element1, element2) {
    var box1 = element1.getBoundingClientRect();
    var box2 = element2.getBoundingClientRect();
    var overlapping = !(box1.right < box2.left || box1.left > box2.right || box1.bottom < box2.top || box1.top > box2.bottom);
    return overlapping;
}

function loadSettings() {
    r_hue = Number(localStorage.getItem("r_hue")) || Math.random();
    dark_theme = JSON.parse(localStorage.getItem("dark_theme")) || false;
    value_type = localStorage.getItem("value_type") || "size";
    fs_percent = JSON.parse(localStorage.getItem("fs_percent")) || false;

    if(value_type == "count") {
        d3.select("#volume-percent").style("visibility", "hidden");
    }

    document.getElementById("dark-theme").checked = dark_theme;

    document.getElementById("hue-slider").value = r_hue * 360;

    document.getElementById("show-fs").checked = fs_percent;

    d3.select("#" + value_type + "radio")
        .attr("checked", "checked");
    setFsVisibility(fs_percent);
}

function setFsVisibility(visible) {
    var percent_text = d3.select("#volume-percent");
    if(visible && value_type == "size") {
        percent_text.style("visibility", "visible");
    } else {
        percent_text.style("visibility", "hidden");
    }
}

function gearClick() {
    var anim_name;
    if(settings_shown) {
        anim_name = "settings_hide";
        settings_shown = false;
    }
    else if(!settings_shown) {
        anim_name = "settings_show";
        settings_shown = true;
    }

    d3.select("#settings")
        .style("animation-name", anim_name)
        .style("animation-duration", "0.3s");
}

function applyTheme() {
    if(dark_theme) {
        d3.select("#loading").style("background", "black");
        d3.select("#directory_name").style("color", "white");
        d3.select("#settings").style("color", "white");
        d3.select("#settings").style("background-color", "darkgrey");
        d3.select("body").style("background-color", "black");
        d3.select("#explanation").style("color", "lightgrey");
        d3.select("#timestamp").style("color", "white");
        d3.selectAll("#circle path").style("stroke-width", "0.5");
        d3.selectAll("#circle path").style("stroke", "black");
    }
    else {
        d3.select("#loading").style("background", "white");
        d3.select("#directory_name").style("color", "black");
        d3.select("#settings").style("color", "black");
        d3.select("#settings").style("background-color", "white");
        d3.select("body").style("background-color", "white");
        d3.select("#explanation").style("color", "#666");
        d3.select("#timestamp").style("color", "black");
        d3.selectAll("#circle path").style("stroke-width", "1px");
        d3.selectAll("#circle path").style("stroke", "white");
    }
}

function fsClick() {
    fs_percent = !fs_percent;
    localStorage.setItem("fs_percent", fs_percent);

    setFsVisibility(fs_percent);
}

function darkThemeClick() {
    dark_theme = !dark_theme;
    localStorage.setItem("dark_theme", dark_theme);
    applyTheme();
}

function onDateSlide(slider) {
    if(slider.id == "max-date-slider" && Number(min_slider.value) > Number(max_slider.value)) {
        min_slider.value = max_slider.value;
    }
    else if(slider.id == "min-date-slider" && Number(min_slider.value) > Number(max_slider.value)) {
        max_slider.value = min_slider.value;
    }
    updateDateSliderText();
    d3.selectAll("path")
        .each(function(d, i) {
            var node = drillDown(sep + "root" + this.id);

            var current_color = this.getAttribute("fill").split(",");
            var fade = getFadeLevel(node.mtime);
            d3.select(this)
                .attr("fill", current_color[0] + ", " + Math.floor(50.0 * fade) + "%, " + current_color[2]);
        });
}

function updateDateSliderText() {
    max_date_text.innerHTML = "Upper Limit: " + max_slider.value + " " + slider_time_unit + " old";
    min_date_text.innerHTML = "Lower Limit: " + min_slider.value + " " + slider_time_unit + " old";
}

function hueChange(new_hue) {
    r_hue = new_hue.target.valueAsNumber / 360;
    colors = {}

    var paths = d3.selectAll("path")[0];
    for(var i = 0; i < paths.length; i++) {
        var color_name = paths[i].id.split(sep).slice(-1)[0];

        var current_sat = paths[i].getAttribute("fill").split(",")[1].slice(1,-1) / 50;
        paths[i].setAttribute("fill", getColor(color_name, current_sat));
    }
    var crumbs = d3.selectAll("polygon")[0];
    var crumb_texts = d3.selectAll("polygon + text")[0];
    for(var i = 0; i < crumbs.length; i++) {
        var color_name = crumb_texts[i].innerHTML;
        crumbs[i].setAttribute("fill", getColor(color_name, 1));
    }
    d3.selectAll(".date-slider").style("--main-color", "hsl(" + (r_hue * 360) + ", 60%, 50%)");

    localStorage.setItem("r_hue", r_hue);
}

function radioChange() {
    if(value_type == "size") {
        value_type = "count";
        d3.select("#volume-percent").style("visibility", "hidden");
    }
    else if(value_type == "count") {
        value_type = "size";
        if(fs_percent) {
            d3.select("#volume-percent").style("visibility", "visible");
        }
    }
    localStorage.setItem("value_type", value_type);

    buildVisual();
}

function setSizes() {
    width = $(window).width();
    height = $(window).height();
    svg_size = Math.min(width, height - 160) * 0.8;

    // Create SVG circle container
    svg = d3.select("#circle")
        .attr("width", svg_size)
        .attr("height", svg_size);

    // Set container to match SVG size
    d3.select("#container")
        .style("width", svg_size + "px")
        .style("height", svg_size + "px");

    radius = Math.max($("#circle").width(), $("#circle").height()) / 2;
    cursor = new Cursor(radius);

    d3.select("#loading")
        .style("visibility", "visible");
}

function buildVisual() {
    setSizes();

    clearGraph();

    d3.selectAll(".date-slider").style("--main-color", "hsl(" + (r_hue * 360) + ", 60%, 50%)");

    var root_node = drillDown(start_root);
    total_value = root_node[value_type];

    var path = "";
    descendNode(root_node, {"progression": 0}, 1, path)
    updateExplanation(false);

    // Make random elements visible that should only show on load
    d3.select("#explanation")
        .style("visibility", "visible");
    d3.select("#settings")
        .style("visibility", "visible");
    d3.select("#gear-icon")
        .style("visibility", "visible");

    updateBreadcrumbs([]);
    applyTheme();
}

function getFadeLevel(node_time) {
    var slide_upper_seconds = current_time - time_units[slider_time_unit] * Number(max_slider.value);
    var slide_lower_seconds = current_time - time_units[slider_time_unit] * Number(min_slider.value);

    if(!fade_on) {
        return 1;
    }
    else {
        var MIN_FADE = 0;

        if(node_time < slide_upper_seconds) {
            return MIN_FADE;
        }
        else if(node_time > slide_lower_seconds) {
            return 1;
        }
        var time_span = slide_lower_seconds - slide_upper_seconds;
        var node_span = newest_dir - node_time;

        var fade = 1 - (node_span / time_span);
        return fade;
    }
}

function descendNode(node, parent, depth, path) {
    path += sep + node.name;
    var node_path = cursor.getPath(node, parent, total_value, depth);
    if(node_path == undefined) {
        return;
    }

    svg.append("path")
      .attr("d", node_path)
      .attr("id", path)
      .attr("value", node[value_type])
      .attr("fill", getColor(node.name, getFadeLevel(node.mtime)))
      .style("position", "relative")
      .style("stroke", "white")
      .style("stroke-width", "1px");

    // Sort children by size
    var child_values = []
    for(var child in node.children) {
        child_values.push(node.children[child])
    }
    var sorted_children = child_values.sort(function(a, b) { return b[value_type] - a[value_type]; })

    for(var i = 0; i < sorted_children.length; i++) {
        descendNode(sorted_children[i], node, depth + 1, path);
    }
}

function drillDown(path) {
    var path_parts = path.split(sep).slice(1);
    var current = json;
    for(var i = 0; i < path_parts.length; i++) {
        current = current[path_parts[i]];
        if(i == path_parts.length - 1) {
            return current;
        }
        current = current.children;
    }
}

function clearGraph() {
    var graph_parts = d3.select("#circle")[0][0].children;
    if(graph_parts == undefined) {
        // Graph doesn't exist yet
        return;
    }

    for(var i = 0; i < graph_parts.length;) {
        if(graph_parts[i].nodeName == "path") {
            graph_parts[i].remove();
        }
    }
}

// Create cursor for constructing circle
var cursor;

// Load JSON
var url_id = url("?id");
if(url_id == undefined) {
    d3.select("#loading").remove();
    d3.select("#value")
        .style("visibility", "visible")
        .text("No plot specified");

}
else if(url_id == "local") {
    d3.text("scan.json", parseJson);
}
else {
    var json_url = "get_json.php?id=" + url("?id");
    d3.text(json_url, parseJson);
}

function setupDateSliders() {
    if(!fade_on) {
        d3.selectAll("[class=date-slider]").attr("disabled", "true");
        d3.select("#date-sliders").style("opacity", "0.5");
    }
    else {
        var min_slider = d3.select("#min-date-slider");
        var max_slider = d3.select("#max-date-slider");

        var time_info = getTimeUnit(newest_dir - oldest_dir).split(" ");
        var time_value = Math.ceil(time_info[0]).toString();
        slider_time_unit = time_info[1];

        min_slider.attr("max", time_value);
        max_slider.attr("max", time_value);

        min_slider[0][0].value = "0";
        max_slider[0][0].value = time_value.toString();
        updateDateSliderText();
    }
}

function getTimeUnit(seconds) {
    for(var unit in time_units) {
        var time_span = seconds / time_units[unit];
        if((time_span > 10 && time_span < 100) || unit == "months") {
            return time_span + " " + unit;
        }
    }
}

function parseJson(response) {
    // Register event handlers
    window.onmouseover = onMouseOver;
    document.addEventListener("mousemove", onMouseMove);

    var circle_element = document.getElementById("circle");
    circle_element.addEventListener("mouseleave", onMouseLeave);

    // Parse JSON and get variables generated by Python script
    if(typeof response != "object") {
        json = JSON.parse(response);
    }
    else {
        json = response;
    }

    sep = json["path_sep"];
    scanned_dir = json["scanned_dir"];
    mtime_on = json["mtime_on"];
    volume_bytes = json["fs_total_bytes"];

    newest_dir = json["newest_dir"];
    oldest_dir = json["oldest_dir"];

    fade_on = json["fade_on"];
    setupDateSliders();

    d3.select("#directory_name").text(json["drive_letter"] + scanned_dir);
    d3.select("#timestamp").text("Created " + moment(json["scan_time"], "X").fromNow());
    document.title = "dv - " + scanned_dir;
    tree_depth = json["tree_depth"];
    start_root = sep + "root" + sep + Object.keys(json.root.children)[0];

    d3.select("#loading")
        .style("transition", "1.2s")
        .style("opacity", "0");

    buildVisual();
}
