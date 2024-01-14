import React, { useState, useEffect } from 'react';

import date_utils from './date_utils';
import { $, createSVG } from './svg_utils';
import Bar from './bar';
import Arrow from './arrow';
import Popup from './popup';

//import './gantt.scss';
import './frappe-gantt.css';

const VIEW_MODE = {
    QUARTER_DAY: 'Quarter Day',
    HALF_DAY: 'Half Day',
    DAY: 'Day',
    WEEK: 'Week',
    MONTH: 'Month',
    YEAR: 'Year',
};

const FrappeGantt = ({tasks, options}) => {

    let $svg = null
    let $container = null
    let $popup_wrapper = null

    useEffect(() =>  {
        setup_wrapper();
        setup_options(options);
        setup_tasks(tasks);
        // initialize with default view mode
        change_view_mode();
        bind_events();
    }, [])

    const setup_wrapper = (element) => {
        //<element (user defined height,width)>
        //  <gantt-wrapper (flex)>
        //    <task-area (flex-item, sticky)>
        //      <svg-container (overflow-x=hidden)>
        //        <svg> </svg>
        //      </svg-container>
        //    </task-area>
        //    <gantt-area (flex-item)>
        //      <svg-container (overflow-x=hidden)>
        //        <svg> </svg>
        //      </svg-container>
        //    </gantt-area>
        //  </gantt-wrapper>
        //</element>
        //
        //
        let svg_element, wrapper_element;

        // CSS Selector is passed
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }

        // get the SVGElement
        if (element instanceof HTMLElement) {
            wrapper_element = element;
            svg_element = element.querySelector('svg');
        } else if (element instanceof SVGElement) {
            svg_element = element;
        } else {
            throw new TypeError(
                'Frappé Gantt only supports usage of a string CSS selector,' +
                    " HTML DOM element or SVG DOM element for the 'element' parameter"
            );
        }

        // svg element
        /** this is a pen */
        $svg = document.getElementById('frappe-gantt')

        // wrapper element
        /** svgのコンテナ(div) */
        $container = document.getElementById('frappe-gantt-container')

        // popup wrapper
        $popup_wrapper = document.getElementById('frappe-popup-wrapper')
    }

    const setup_options = (options) => {
        const default_options = {
            header_height: 50,
            column_width: 30,
            step: 24,
            view_modes: [...Object.values(VIEW_MODE)],
            bar_height: 20,
            bar_corner_radius: 3,
            arrow_curve: 5,
            padding: 18,
            view_mode: 'Day',
            date_format: 'YYYY-MM-DD',
            popup_trigger: 'click',
            custom_popup_html: null,
            language: 'en',
        };
        options = Object.assign({}, default_options, options);
    }

    const setup_tasks = (tasks) => {
        // prepare tasks
        tasks = tasks.map((task, i) => {
            // convert to Date objects
            task._start = date_utils.parse(task.start);
            task._end = date_utils.parse(task.end);

            // make task invalid if duration too large
            if (date_utils.diff(task._end, task._start, 'year') > 10) {
                task.end = null;
            }

            // cache index
            task._index = i;

            // invalid dates
            if (!task.start && !task.end) {
                const today = date_utils.today();
                task._start = today;
                task._end = date_utils.add(today, 2, 'day');
            }

            if (!task.start && task.end) {
                task._start = date_utils.add(task._end, -2, 'day');
            }

            if (task.start && !task.end) {
                task._end = date_utils.add(task._start, 2, 'day');
            }

            // if hours is not set, assume the last day is full day
            // e.g: 2018-09-09 becomes 2018-09-09 23:59:59
            const task_end_values = date_utils.get_date_values(task._end);
            if (task_end_values.slice(3).every((d) => d === 0)) {
                task._end = date_utils.add(task._end, 24, 'hour');
            }

            // invalid flag
            if (!task.start || !task.end) {
                task.invalid = true;
            }

            // dependencies
            if (typeof task.dependencies === 'string' || !task.dependencies) {
                let deps = [];
                if (task.dependencies) {
                    deps = task.dependencies
                        .split(',')
                        .map((d) => d.trim())
                        .filter((d) => d);
                }
                task.dependencies = deps;
            }

            // uids
            if (!task.id) {
                task.id = generate_id(task);
            }

            return task;
        });

        setup_dependencies();
    }

    const setup_dependencies = () => {
        dependency_map = {};
        for (let t of tasks) {
            for (let d of t.dependencies) {
                dependency_map[d] = dependency_map[d] || [];
                dependency_map[d].push(t.id);
            }
        }
    }

    const refresh = (tasks) => {
        setup_tasks(tasks);
        change_view_mode();
    }

    const change_view_mode = (mode = options.view_mode) => {
        update_view_scale(mode);
        setup_dates();
        render();
        // fire viewmode_change event
        trigger_event('view_change', [mode]);
    }

    const update_view_scale = (view_mode) => {
        options.view_mode = view_mode;

        if (view_mode === VIEW_MODE.DAY) {
            options.step = 24;
            options.column_width = 38;
        } else if (view_mode === VIEW_MODE.HALF_DAY) {
            options.step = 24 / 2;
            options.column_width = 38;
        } else if (view_mode === VIEW_MODE.QUARTER_DAY) {
            options.step = 24 / 4;
            options.column_width = 38;
        } else if (view_mode === VIEW_MODE.WEEK) {
            options.step = 24 * 7;
            options.column_width = 140;
        } else if (view_mode === VIEW_MODE.MONTH) {
            options.step = 24 * 30;
            options.column_width = 120;
        } else if (view_mode === VIEW_MODE.YEAR) {
            options.step = 24 * 365;
            options.column_width = 120;
        }
    }

    const setup_dates = () => {
        setup_gantt_dates();
        setup_date_values();
    }

    const setup_gantt_dates = () => {
        gantt_start = gantt_end = null;

        for (let task of tasks) {
            // set global start and end date
            if (!gantt_start || task._start < gantt_start) {
                gantt_start = task._start;
            }
            if (!gantt_end || task._end > gantt_end) {
                gantt_end = task._end;
            }
        }

        gantt_start = date_utils.start_of(gantt_start, 'day');
        gantt_end = date_utils.start_of(gantt_end, 'day');

        // add date padding on both sides
        if (view_is([VIEW_MODE.QUARTER_DAY, VIEW_MODE.HALF_DAY])) {
            gantt_start = date_utils.add(gantt_start, -7, 'day');
            gantt_end = date_utils.add(gantt_end, 7, 'day');
        } else if (view_is(VIEW_MODE.MONTH)) {
            gantt_start = date_utils.start_of(gantt_start, 'year');
            gantt_end = date_utils.add(gantt_end, 1, 'year');
        } else if (view_is(VIEW_MODE.YEAR)) {
            gantt_start = date_utils.add(gantt_start, -2, 'year');
            gantt_end = date_utils.add(gantt_end, 2, 'year');
        } else {
            gantt_start = date_utils.add(gantt_start, -1, 'month');
            gantt_end = date_utils.add(gantt_end, 1, 'month');
        }
    }

    const setup_date_values = () => {
        dates = [];
        let cur_date = null;

        while (cur_date === null || cur_date < gantt_end) {
            if (!cur_date) {
                cur_date = date_utils.clone(gantt_start);
            } else {
                if (view_is(VIEW_MODE.YEAR)) {
                    cur_date = date_utils.add(cur_date, 1, 'year');
                } else if (view_is(VIEW_MODE.MONTH)) {
                    cur_date = date_utils.add(cur_date, 1, 'month');
                } else {
                    cur_date = date_utils.add(
                        cur_date,
                        options.step,
                        'hour'
                    );
                }
            }
            dates.push(cur_date);
        }
    }

    const bind_events = () => {
        bind_grid_click();
        bind_bar_events();
    }

    const render = () => {
        clear();
        setup_layers();
        make_grid();
        make_dates();
        make_bars();
        make_arrows();
        map_arrows_on_bars();
        set_width();
        set_scroll_position();
    }

    const setup_layers = () => {
        layers = {};
        const layers = ['grid', 'date', 'arrow', 'progress', 'bar', 'details'];
        // make group layers
        for (let layer of layers) {
            layers[layer] = createSVG('g', {
                class: layer,
                append_to: $svg,
            });
        }
    }

    const make_grid = () => {
        make_grid_background();
        make_grid_rows();
        make_grid_header();
        make_grid_ticks();
        make_grid_highlights();
    }

    const make_grid_background = () => {
        const grid_width = dates.length * options.column_width;
        const grid_height =
            options.header_height +
            options.padding +
            (options.bar_height + options.padding) *
                tasks.length;

        createSVG('rect', {
            x: 0,
            y: 0,
            width: grid_width,
            height: grid_height,
            class: 'grid-background',
            append_to: layers.grid,
        });

        $.attr($svg, {
            height: grid_height + options.padding + 100,
            width: '100%',
        });
    }

    const make_grid_rows = () => {
        const rows_layer = createSVG('g', { append_to: layers.grid });
        const lines_layer = createSVG('g', { append_to: layers.grid });

        const row_width = dates.length * options.column_width;
        const row_height = options.bar_height + options.padding;

        let row_y = options.header_height + options.padding / 2;

        for (let task of tasks) {
            createSVG('rect', {
                x: 0,
                y: row_y,
                width: row_width,
                height: row_height,
                class: 'grid-row',
                append_to: rows_layer,
            });

            createSVG('line', {
                x1: 0,
                y1: row_y + row_height,
                x2: row_width,
                y2: row_y + row_height,
                class: 'row-line',
                append_to: lines_layer,
            });

            row_y += options.bar_height + options.padding;
        }
    }

    const make_grid_header = () => {
        const header_width = dates.length * options.column_width;
        const header_height = options.header_height + 10;
        createSVG('rect', {
            x: 0,
            y: 0,
            width: header_width,
            height: header_height,
            class: 'grid-header',
            append_to: layers.grid,
        });
    }

    const make_grid_ticks = () => {
        let tick_x = 0;
        let tick_y = options.header_height + options.padding / 2;
        let tick_height =
            (options.bar_height + options.padding) *
            tasks.length;

        for (let date of dates) {
            let tick_class = 'tick';
            // thick tick for monday
            if (view_is(VIEW_MODE.DAY) && date.getDate() === 1) {
                tick_class += ' thick';
            }
            // thick tick for first week
            if (
                view_is(VIEW_MODE.WEEK) &&
                date.getDate() >= 1 &&
                date.getDate() < 8
            ) {
                tick_class += ' thick';
            }
            // thick ticks for quarters
            if (view_is(VIEW_MODE.MONTH) && date.getMonth() % 3 === 0) {
                tick_class += ' thick';
            }

            createSVG('path', {
                d: `M ${tick_x} ${tick_y} v ${tick_height}`,
                class: tick_class,
                append_to: layers.grid,
            });

            if (view_is(VIEW_MODE.MONTH)) {
                tick_x +=
                    (date_utils.get_days_in_month(date) *
                        options.column_width) /
                    30;
            } else {
                tick_x += options.column_width;
            }
        }
    }

    const make_grid_highlights = () => {
        // highlight today's date
        if (view_is(VIEW_MODE.DAY)) {
            const x =
                (date_utils.diff(date_utils.today(), gantt_start, 'hour') /
                    options.step) *
                options.column_width;
            const y = 0;

            const width = options.column_width;
            const height =
                (options.bar_height + options.padding) *
                    tasks.length +
                options.header_height +
                options.padding / 2;

            createSVG('rect', {
                x,
                y,
                width,
                height,
                class: 'today-highlight',
                append_to: layers.grid,
            });
        }
    }

    const make_dates = () => {
        for (let date of get_dates_to_draw()) {
            createSVG('text', {
                x: date.lower_x,
                y: date.lower_y,
                innerHTML: date.lower_text,
                class: 'lower-text',
                append_to: layers.date,
            });

            if (date.upper_text) {
                const $upper_text = createSVG('text', {
                    x: date.upper_x,
                    y: date.upper_y,
                    innerHTML: date.upper_text,
                    class: 'upper-text',
                    append_to: layers.date,
                });

                // remove out-of-bound dates
                if (
                    $upper_text.getBBox().x2 > layers.grid.getBBox().width
                ) {
                    $upper_text.remove();
                }
            }
        }
    }

    const get_dates_to_draw = () => {
        let last_date = null;
        const dates = dates.map((date, i) => {
            const d = get_date_info(date, last_date, i);
            last_date = date;
            return d;
        });
        return dates;
    }

    const get_date_info = (date, last_date, i) => {
        if (!last_date) {
            last_date = date_utils.add(date, 1, 'year');
        }
        const date_text = {
            'Quarter Day_lower': date_utils.format(
                date,
                'HH',
                options.language
            ),
            'Half Day_lower': date_utils.format(
                date,
                'HH',
                options.language
            ),
            Day_lower:
                date.getDate() !== last_date.getDate()
                    ? date_utils.format(date, 'D', options.language)
                    : '',
            Week_lower:
                date.getMonth() !== last_date.getMonth()
                    ? date_utils.format(date, 'D MMM', options.language)
                    : date_utils.format(date, 'D', options.language),
            Month_lower: date_utils.format(date, 'MMMM', options.language),
            Year_lower: date_utils.format(date, 'YYYY', options.language),
            'Quarter Day_upper':
                date.getDate() !== last_date.getDate()
                    ? date_utils.format(date, 'D MMM', options.language)
                    : '',
            'Half Day_upper':
                date.getDate() !== last_date.getDate()
                    ? date.getMonth() !== last_date.getMonth()
                        ? date_utils.format(
                              date,
                              'D MMM',
                              options.language
                          )
                        : date_utils.format(date, 'D', options.language)
                    : '',
            Day_upper:
                date.getMonth() !== last_date.getMonth()
                    ? date_utils.format(date, 'MMMM', options.language)
                    : '',
            Week_upper:
                date.getMonth() !== last_date.getMonth()
                    ? date_utils.format(date, 'MMMM', options.language)
                    : '',
            Month_upper:
                date.getFullYear() !== last_date.getFullYear()
                    ? date_utils.format(date, 'YYYY', options.language)
                    : '',
            Year_upper:
                date.getFullYear() !== last_date.getFullYear()
                    ? date_utils.format(date, 'YYYY', options.language)
                    : '',
        };

        const base_pos = {
            x: i * options.column_width,
            lower_y: options.header_height,
            upper_y: options.header_height - 25,
        };

        const x_pos = {
            'Quarter Day_lower': (options.column_width * 4) / 2,
            'Quarter Day_upper': 0,
            'Half Day_lower': (options.column_width * 2) / 2,
            'Half Day_upper': 0,
            Day_lower: options.column_width / 2,
            Day_upper: (options.column_width * 30) / 2,
            Week_lower: 0,
            Week_upper: (options.column_width * 4) / 2,
            Month_lower: options.column_width / 2,
            Month_upper: (options.column_width * 12) / 2,
            Year_lower: options.column_width / 2,
            Year_upper: (options.column_width * 30) / 2,
        };

        return {
            upper_text: date_text[`${options.view_mode}_upper`],
            lower_text: date_text[`${options.view_mode}_lower`],
            upper_x: base_pos.x + x_pos[`${options.view_mode}_upper`],
            upper_y: base_pos.upper_y,
            lower_x: base_pos.x + x_pos[`${options.view_mode}_lower`],
            lower_y: base_pos.lower_y,
        };
    }

    const make_bars = () => {
        bars = tasks.map((task) => {
            const bar = new Bar(this, task);
            layers.bar.appendChild(bar.group);
            return bar;
        });
    }

    const make_arrows = () => {
        arrows = [];
        for (let task of tasks) {
            let arrows = [];
            arrows = task.dependencies
                .map((task_id) => {
                    const dependency = get_task(task_id);
                    if (!dependency) return;
                    const arrow = new Arrow(
                        this,
                        bars[dependency._index], // from_task
                        bars[task._index] // to_task
                    );
                    layers.arrow.appendChild(arrow.element);
                    return arrow;
                })
                .filter(Boolean); // filter falsy values
            arrows = arrows.concat(arrows);
        }
    }

    const map_arrows_on_bars = () => {
        for (let bar of bars) {
            bar.arrows = arrows.filter((arrow) => {
                return (
                    arrow.from_task.task.id === bar.task.id ||
                    arrow.to_task.task.id === bar.task.id
                );
            });
        }
    }

    const set_width = () => {
        const cur_width = $svg.getBoundingClientRect().width;
        const actual_width = $svg
            .querySelector('.grid .grid-row')
            .getAttribute('width');
        if (cur_width < actual_width) {
            $svg.setAttribute('width', actual_width);
        }
    }

    const set_scroll_position = () => {
        const parent_element = $svg.parentElement;
        if (!parent_element) return;

        const hours_before_first_task = date_utils.diff(
            get_oldest_starting_date(),
            gantt_start,
            'hour'
        );

        const scroll_pos =
            (hours_before_first_task / options.step) *
                options.column_width -
            options.column_width;

        parent_element.scrollLeft = scroll_pos;
    }

    const bind_grid_click = () => {
        $.on(
            $svg,
            options.popup_trigger,
            '.grid-row, .grid-header',
            () => {
                unselect_all();
                hide_popup();
            }
        );
    }

    const bind_bar_events = () => {
        let is_dragging = false;
        let x_on_start = 0;
        let y_on_start = 0;
        let is_resizing_left = false;
        let is_resizing_right = false;
        let parent_bar_id = null;
        let bars = []; // instanceof Bar
        bar_id_being_dragged = null;

        function is_action_in_progress() {
            return is_dragging || is_resizing_left || is_resizing_right;
        }
        function is_this_bar_at_the_head(bar) {
            return parent_bar_id === bar.task.id
        }

        $.on($svg, 'mousedown', '.bar-wrapper, .handle', (e, element) => {
            const bar_wrapper = $.closest('.bar-wrapper', element);

            if (element.classList.contains('left')) {
                is_resizing_left = true;
            } else if (element.classList.contains('right')) {
                is_resizing_right = true;
            } else if (element.classList.contains('bar-wrapper')) {
                is_dragging = true;
            }

            bar_wrapper.classList.add('active');

            x_on_start = e.offsetX;
            y_on_start = e.offsetY;

            parent_bar_id = bar_wrapper.getAttribute('data-id');
            const ids = [
                parent_bar_id,
                ...get_all_dependent_tasks(parent_bar_id),
            ];
            bars = ids.map((id) => get_bar(id));

            bar_id_being_dragged = parent_bar_id;

            bars.forEach((bar) => {
                const $bar = bar.$bar;
                $bar.ox = $bar.getX();
                $bar.oy = $bar.getY();
                $bar.owidth = $bar.getWidth();
                $bar.finaldx = 0;
            });
        });

        $.on($svg, 'mousemove', (e) => {
            if (!is_action_in_progress()) return;
            const dx = e.offsetX - x_on_start;
            const dy = e.offsetY - y_on_start;

            bars.forEach((bar) => {
                const $bar = bar.$bar;
                $bar.finaldx = get_snap_position(dx);
                hide_popup();
                if (is_resizing_left) {
                    if (is_this_bar_at_the_head(bar)) {
                        bar.update_bar_position({
                            x: $bar.ox + $bar.finaldx,
                            width: $bar.owidth - $bar.finaldx,
                        });
                    } else {
                        bar.update_bar_position({
                            x: $bar.ox + $bar.finaldx,
                        });
                    }
                } else if (is_resizing_right) {
                    if (is_this_bar_at_the_head(bar)) {
                        bar.update_bar_position({
                            width: $bar.owidth + $bar.finaldx,
                        });
                    }
                } else if (is_dragging) {
                    bar.update_bar_position({ x: $bar.ox + $bar.finaldx });
                }
            });
        });

        document.addEventListener('mouseup', (e) => {
            if (is_dragging || is_resizing_left || is_resizing_right) {
                bars.forEach((bar) => bar.group.classList.remove('active'));
            }

            is_dragging = false;
            is_resizing_left = false;
            is_resizing_right = false;
        });

        $.on($svg, 'mouseup', (e) => {
            bar_id_being_dragged = null;
            bars.forEach((bar) => {
                const $bar = bar.$bar;
                if (!$bar.finaldx) return;
                bar.date_changed();
                bar.set_action_completed();
            });
        });

        bind_bar_progress();
    }

    const bind_bar_progress = () => {
        let x_on_start = 0;
        let y_on_start = 0;
        let is_resizing = null;
        let bar = null;
        let $bar_progress = null;
        let $bar = null;

        $.on($svg, 'mousedown', '.handle.progress', (e, handle) => {
            is_resizing = true;
            x_on_start = e.offsetX;
            y_on_start = e.offsetY;

            const $bar_wrapper = $.closest('.bar-wrapper', handle);
            const id = $bar_wrapper.getAttribute('data-id');
            bar = get_bar(id);

            $bar_progress = bar.$bar_progress;
            $bar = bar.$bar;

            $bar_progress.finaldx = 0;
            $bar_progress.owidth = $bar_progress.getWidth();
            $bar_progress.min_dx = -$bar_progress.getWidth();
            $bar_progress.max_dx = $bar.getWidth() - $bar_progress.getWidth();
        });

        $.on($svg, 'mousemove', (e) => {
            if (!is_resizing) return;
            let dx = e.offsetX - x_on_start;
            let dy = e.offsetY - y_on_start;

            if (dx > $bar_progress.max_dx) {
                dx = $bar_progress.max_dx;
            }
            if (dx < $bar_progress.min_dx) {
                dx = $bar_progress.min_dx;
            }

            const $handle = bar.$handle_progress;
            $.attr($bar_progress, 'width', $bar_progress.owidth + dx);
            $.attr($handle, 'points', bar.get_progress_polygon_points());
            $bar_progress.finaldx = dx;
        });

        $.on($svg, 'mouseup', () => {
            is_resizing = false;
            if (!($bar_progress && $bar_progress.finaldx)) return;
            bar.progress_changed();
            bar.set_action_completed();
        });
    }

    const get_all_dependent_tasks = (task_id) => {
        let out = [];
        let to_process = [task_id];
        while (to_process.length) {
            const deps = to_process.reduce((acc, curr) => {
                acc = acc.concat(dependency_map[curr]);
                return acc;
            }, []);

            out = out.concat(deps);
            to_process = deps.filter((d) => !to_process.includes(d));
        }

        return out.filter(Boolean);
    }

    const get_snap_position = (dx) => {
        let odx = dx,
            rem,
            position;

        if (view_is(VIEW_MODE.WEEK)) {
            rem = dx % (options.column_width / 7);
            position =
                odx -
                rem +
                (rem < options.column_width / 14
                    ? 0
                    : options.column_width / 7);
        } else if (view_is(VIEW_MODE.MONTH)) {
            rem = dx % (options.column_width / 30);
            position =
                odx -
                rem +
                (rem < options.column_width / 60
                    ? 0
                    : options.column_width / 30);
        } else {
            rem = dx % options.column_width;
            position =
                odx -
                rem +
                (rem < options.column_width / 2
                    ? 0
                    : options.column_width);
        }
        return position;
    }

    const unselect_all = () => {
        [...$svg.querySelectorAll('.bar-wrapper')].forEach((el) => {
            el.classList.remove('active');
        });
    }

    const view_is = (modes) => {
        if (typeof modes === 'string') {
            return options.view_mode === modes;
        }

        if (Array.isArray(modes)) {
            return modes.some((mode) => options.view_mode === mode);
        }

        return false;
    }

    const get_task = (id) => {
        return tasks.find((task) => {
            return task.id === id;
        });
    }

    const get_bar = (id) => {
        return bars.find((bar) => {
            return bar.task.id === id;
        });
    }

    const show_popup = (options) => {
        if (!popup) {
            popup = new Popup(
                popup_wrapper,
                options.custom_popup_html
            );
        }
        popup.show(options);
    }

    const hide_popup = () => {
        popup && popup.hide();
    }

    const trigger_event = (event, args) => {
        if (options['on_' + event]) {
            options['on_' + event].apply(null, args);
        }
    }

    /**
     * Gets the oldest starting date from the list of tasks
     *
     * @returns Date
     * @memberof Gantt
     */
    const get_oldest_starting_date = () => {
        return tasks
            .map((task) => task._start)
            .reduce((prev_date, cur_date) =>
                cur_date <= prev_date ? cur_date : prev_date
            );
    }

    /**
     * Clear all elements from the parent svg element
     *
     * @memberof Gantt
     */
    const clear = () => {
        $svg.innerHTML = '';
    }

    return (
        <div id='frappe-gantt-container' class='gantt-container'>
            <div id='frappe-popup-wrapper' class='popup-wrapper' />
            <svg id='frappe-gantt' className='gantt' />
        </div>
        
    )
}

Gantt.VIEW_MODE = VIEW_MODE;

function generate_id(task) {
    return task.name + '_' + Math.random().toString(36).slice(2, 12);
}


export default FrappeGantt