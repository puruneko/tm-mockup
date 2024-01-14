import React from 'react'

import date_utils from './date_utils';
import { $, createSVG } from './svg_utils';
import Bar from './bar';
import Arrow from './arrow';
import Popup from './popup';

import './frappe-gantt.css';

const VIEW_MODE = {
    QUARTER_DAY: 'Quarter Day',
    HALF_DAY: 'Half Day',
    DAY: 'Day',
    WEEK: 'Week',
    MONTH: 'Month',
    YEAR: 'Year',
};

type GanttState = {
    wrapper: React.Component | string,
    werapper_header: React.Component | string,
    tasks: Array<any>,
    options: {[name: string]: any},
    $svg: SVGElement,
    $container: HTMLElement,
    popup_wrapper: HTMLElement,
}

export default class Gantt extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            wrapper: props.wrapper,
            wrapper_header: props.wrapper_header,
            tasks: props.tasks,
            options: props.options||{},
        }
    }

    componentDidMount() {
        console.log('frappe-gantt >>> componentDidMount')
        this.setup_wrapper(this.state.wrapper, this.state.wrapper_header);
        this.setup()
        console.log('frappe-gantt <<< componentDidMount')
    }

    setup() {
        console.log('frappe-gantt >>> setup')
        this.setup_options(this.state.options);
        this.setup_tasks(this.state.tasks);
        // initialize with default view mode
        this.change_view_mode();
        this.bind_events();
        console.log('frappe-gantt <<< setup')
    }

    setup_wrapper(element, header_element) {
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

        /**SVGエレメントのトップ */
        this.state.$svg = null;
        /**svgエレメントの一時変数 */
        let svg_element
        /**SVGエレメントのラッパーDivエレメントの一時変数 */
        let wrapper_element

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
        if (!svg_element) {
            // create it
            this.state.$svg = createSVG('svg', {
                append_to: wrapper_element,
                class: 'gantt',
            });
        } else {
            this.state.$svg = svg_element;
            this.state.$svg.classList.add('gantt');
        }


        // wrapper element
        /** svgのコンテナ(div) */
        this.state.$container = document.createElement('div');
        this.state.$container.classList.add('gantt-container');

        const parent_element = this.state.$svg.parentElement;
        parent_element.appendChild(this.state.$container);
        this.state.$container.appendChild(this.state.$svg);

        // popup wrapper
        this.state.popup_wrapper = document.createElement('div');
        this.state.popup_wrapper.classList.add('popup-wrapper');
        this.state.$container.appendChild(this.state.popup_wrapper);
    }

    setup_options(options) {
        const default_options = {
            header_height: 50,
            column_width: 30,
            step: 24, //1マス当たりの時間[h]
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
        this.state.options = Object.assign({}, default_options, options);
    }

    setup_tasks(tasks) {
        // prepare tasks
        this.state.tasks = tasks.map((task, i) => {
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

        this.setup_dependencies();
    }

    setup_dependencies() {
        this.state.dependency_map = {};
        for (let t of this.state.tasks) {
            for (let d of t.dependencies) {
                this.state.dependency_map[d] = this.state.dependency_map[d] || [];
                this.state.dependency_map[d].push(t.id);
            }
        }
    }

    refresh(tasks) {
        this.setup_tasks(tasks);
        this.change_view_mode();
    }

    change_view_mode(mode = this.state.options.view_mode) {
        this.update_view_scale(mode);
        this.setup_dates();
        this.render_gantt();
        // fire viewmode_change event
        this.trigger_event('view_change', [mode]);
    }

    update_view_scale(view_mode) {
        this.state.options.view_mode = view_mode;

        if (view_mode === VIEW_MODE.DAY) {
            this.state.options.step = 24;
            this.state.options.column_width = 38;
        } else if (view_mode === VIEW_MODE.HALF_DAY) {
            this.state.options.step = 24 / 2;
            this.state.options.column_width = 38;
        } else if (view_mode === VIEW_MODE.QUARTER_DAY) {
            this.state.options.step = 24 / 4;
            this.state.options.column_width = 38;
        } else if (view_mode === VIEW_MODE.WEEK) {
            this.state.options.step = 24 * 7;
            this.state.options.column_width = 140;
        } else if (view_mode === VIEW_MODE.MONTH) {
            this.state.options.step = 24 * 30;
            this.state.options.column_width = 120;
        } else if (view_mode === VIEW_MODE.YEAR) {
            this.state.options.step = 24 * 365;
            this.state.options.column_width = 120;
        }
    }

    setup_dates() {
        this.setup_gantt_dates();
        this.setup_date_values();
    }

    setup_gantt_dates() {
        this.state.gantt_start = this.state.gantt_end = null;

        for (let task of this.state.tasks) {
            // set global start and end date
            if (!this.state.gantt_start || task._start < this.state.gantt_start) {
                this.state.gantt_start = task._start;
            }
            if (!this.state.gantt_end || task._end > this.state.gantt_end) {
                this.state.gantt_end = task._end;
            }
        }

        this.state.gantt_start = date_utils.start_of(this.state.gantt_start, 'day');
        this.state.gantt_end = date_utils.start_of(this.state.gantt_end, 'day');

        // add date padding on both sides
        if (this.view_is([VIEW_MODE.QUARTER_DAY, VIEW_MODE.HALF_DAY])) {
            this.state.gantt_start = date_utils.add(this.state.gantt_start, -7, 'day');
            this.state.gantt_end = date_utils.add(this.state.gantt_end, 7, 'day');
        } else if (this.view_is(VIEW_MODE.MONTH)) {
            this.state.gantt_start = date_utils.start_of(this.state.gantt_start, 'year');
            this.state.gantt_end = date_utils.add(this.state.gantt_end, 1, 'year');
        } else if (this.view_is(VIEW_MODE.YEAR)) {
            this.state.gantt_start = date_utils.add(this.state.gantt_start, -2, 'year');
            this.state.gantt_end = date_utils.add(this.state.gantt_end, 2, 'year');
        } else {
            this.state.gantt_start = date_utils.add(this.state.gantt_start, -1, 'month');
            this.state.gantt_end = date_utils.add(this.state.gantt_end, 1, 'month');
        }
    }

    setup_date_values() {
        this.state.dates = [];
        let cur_date = null;

        while (cur_date === null || cur_date < this.state.gantt_end) {
            if (!cur_date) {
                cur_date = date_utils.clone(this.state.gantt_start);
            } else {
                if (this.view_is(VIEW_MODE.YEAR)) {
                    cur_date = date_utils.add(cur_date, 1, 'year');
                } else if (this.view_is(VIEW_MODE.MONTH)) {
                    cur_date = date_utils.add(cur_date, 1, 'month');
                } else {
                    cur_date = date_utils.add(
                        cur_date,
                        this.state.options.step,
                        'hour'
                    );
                }
            }
            this.state.dates.push(cur_date);
        }
    }

    bind_events() {
        this.bind_grid_click();
        this.bind_bar_events();
    }

    render_gantt() {
        this.clear();
        this.setup_layers();
        this.make_grid();
        this.make_header_date_labels();
        this.make_bars();
        this.make_arrows();
        this.map_arrows_on_bars();
        this.set_width();
        this.set_scroll_position();
    }

    setup_layers() {
        this.state.layers = {};
        const layers = ['grid', 'date', 'arrow', 'progress', 'bar', 'details'];
        // make group layers
        for (let layer of layers) {
            this.state.layers[layer] = createSVG('g', {
                class: layer,
                append_to: this.state.$svg,
            });
        }
    }

    make_grid() {
        this.make_grid_background();
        this.make_grid_rows();
        this.make_grid_header();
        this.make_grid_ticks();
        this.make_grid_highlights();
    }

    /**
     * gridの背景の作成
     */
    make_grid_background() {
        /**grid背景の横幅 = 日数*1マスの横幅 */
        const grid_width = this.state.dates.length * this.state.options.column_width;
        /**grid背景の縦幅 = header高さ+padding+(barの高さ+padding)*タスク数 */
        const grid_height =
            this.state.options.header_height +
            this.state.options.padding +
            (this.state.options.bar_height + this.state.options.padding) *
                this.state.tasks.length;

        /**gridの背景オブジェクト */
        createSVG('rect', {
            x: 0,
            y: 0,
            width: grid_width,
            height: grid_height,
            class: 'grid-background',
            append_to: this.state.layers.grid,
        });

        //SVGの高さをgrid背景の高さ+padding+100に設定
        $.attr(this.state.$svg, {
            height: grid_height + this.state.options.padding + 100,
            width: '100%',
        });
    }

    /**
     * 行ブロックと横線の作成
     */
    make_grid_rows() {
        const rows_layer = createSVG('g', { append_to: this.state.layers.grid });
        const lines_layer = createSVG('g', { append_to: this.state.layers.grid });

        /**行の長さ = 日数*1マスの横幅 */
        const row_width = this.state.dates.length * this.state.options.column_width;
        /**行の高さ = barの高さ+padding */
        const row_height = this.state.options.bar_height + this.state.options.padding;

        /**現在の行のy座標（初期値 = headerの高さ+padding/2 */
        let row_y = this.state.options.header_height + this.state.options.padding / 2;

        for (let task of this.state.tasks) {
            //行の作成
            createSVG('rect', {
                x: 0,
                y: row_y,
                width: row_width,
                height: row_height,
                class: 'grid-row',
                append_to: rows_layer,
            });

            //横線の作成
            createSVG('line', {
                x1: 0,
                y1: row_y + row_height,
                x2: row_width,
                y2: row_y + row_height,
                class: 'row-line',
                append_to: lines_layer,
            });

            //y座標をbarの高さ+padding分下にずらす
            row_y += this.state.options.bar_height + this.state.options.padding;
        }
    }

    /**
     * headerの背景の作成
     */
    make_grid_header() {
        /**headerの横幅 = 日数*1マス横幅 */
        const header_width = this.state.dates.length * this.state.options.column_width;
        /**headerの高さ = headerの高さ(定義)+10 */
        const header_height = this.state.options.header_height + 10;
        //headerの背景作成
        createSVG('rect', {
            x: 0,
            y: 0,
            width: header_width,
            height: header_height,
            class: 'grid-header',
            append_to: this.state.layers.grid,
        });
    }

    /**
     * 縦線(列)の作成
     */
    make_grid_ticks() {
        /**縦線の現在のx座標（初期値=0） */
        let tick_x = 0;
        /**縦線の現在のy座標（初期値=headerの高さ+padding/2） */
        let tick_y = this.state.options.header_height + this.state.options.padding / 2;
        /**縦線の高さ = (barの高さ+padding)*タスク数 */
        let tick_height =
            (this.state.options.bar_height + this.state.options.padding) *
            this.state.tasks.length;

        for (let date of this.state.dates) {
            let tick_class = 'tick';
            //DAYモードで月曜日の場合は線を太くする
            if (this.view_is(VIEW_MODE.DAY) && date.getDate() === 1) {
                tick_class += ' thick';
            }
            //WEEKモードで最初の週の場合は線を太くする
            if (
                this.view_is(VIEW_MODE.WEEK) &&
                date.getDate() >= 1 &&
                date.getDate() < 8
            ) {
                tick_class += ' thick';
            }
            //MONTHモードで4半期区切りの場合は線を太くする
            if (this.view_is(VIEW_MODE.MONTH) && date.getMonth() % 3 === 0) {
                tick_class += ' thick';
            }

            //線を引く
            createSVG('path', {
                d: `M ${tick_x} ${tick_y} v ${tick_height}`,
                class: tick_class,
                append_to: this.state.layers.grid,
            });

            //MONTHモードの場合、すべての月が同じ幅になるように調整した値分横にずらす
            if (this.view_is(VIEW_MODE.MONTH)) {
                tick_x +=
                    (date_utils.get_days_in_month(date) *
                        this.state.options.column_width) /
                    30;
            } else {
                //1マス分の横にずらす
                tick_x += this.state.options.column_width;
            }
        }
    }

    /**
     * 今日にハイライトを入れる（DAYモードのみ）
     */
    make_grid_highlights() {
        if (this.view_is(VIEW_MODE.DAY)) {
            /**highlightのx座標 = (gantt開始日と今日の時間差[h])/step*1マス横幅 */
            const x =
                (date_utils.diff(date_utils.today(), this.state.gantt_start, 'hour') /
                    this.state.options.step) *
                this.state.options.column_width;
            /**highlightのy座標 */
            const y = 0;

            /**highlightの幅 = 1マス幅 */
            const width = this.state.options.column_width;
            /**highlightの高さ = header高さ+task分の高さ */
            const height =
                (this.state.options.bar_height + this.state.options.padding) *
                    this.state.tasks.length +
                this.state.options.header_height +
                this.state.options.padding / 2;

            //今日をrectを使ってhighlightする
            createSVG('rect', {
                x,
                y,
                width,
                height,
                class: 'today-highlight',
                append_to: this.state.layers.grid,
            });
        }
    }

    /**
     * 日付をヘッダに表示する
     */
    make_header_date_labels() {
        for (let date of this.get_date_labels()) {
            //下段の表示を生成
            createSVG('text', {
                x: date.lower_x,
                y: date.lower_y,
                innerHTML: date.lower_text,
                class: 'lower-text',
                append_to: this.state.layers.date,
            });

            //上段の表示がある場合は生成
            if (date.upper_text) {
                const $upper_text = createSVG('text', {
                    x: date.upper_x,
                    y: date.upper_y,
                    innerHTML: date.upper_text,
                    class: 'upper-text',
                    append_to: this.state.layers.date,
                });

                //上段のテキストがはみ出ている場合は削除する
                if (
                    $upper_text.getBBox().x2 > this.state.layers.grid.getBBox().width
                ) {
                    $upper_text.remove();
                }
            }
        }
    }

    /**
     * ヘッダに表示する日付関連の情報を計算する
     * @returns ヘッダに表示する日付関連の情報（配列）
     */
    get_date_labels() {
        let last_date = null;
        const dates = this.state.dates.map((date, i) => {
            const d = this.get_date_label_info(date, last_date, i);
            last_date = date;
            return d;
        });
        return dates;
    }

    /**
     * モードに応じた日付の大分類・小分類とその座標を取得する。
     * @param date - 日付
     * @param last_date - 1マス前の日付（1日前）
     * @param i - 渡された日付のインデックス
     * @returns 計算された日付関連情報
     */
    get_date_label_info(date, last_date, i) {
        if (!last_date) {
            last_date = date_utils.add(date, 1, 'year');
        }
        /**日付の表示テキスト（上段・下段） */
        const date_text = {
            'Quarter Day_lower': date_utils.format(
                date,
                'HH',
                this.state.options.language
            ),
            'Half Day_lower': date_utils.format(
                date,
                'HH',
                this.state.options.language
            ),
            Day_lower:
                date.getDate() !== last_date.getDate()
                    ? date_utils.format(date, 'D', this.state.options.language)
                    : '',
            Week_lower:
                date.getMonth() !== last_date.getMonth()
                    ? date_utils.format(date, 'D MMM', this.state.options.language)
                    : date_utils.format(date, 'D', this.state.options.language),
            Month_lower: date_utils.format(date, 'MMMM', this.state.options.language),
            Year_lower: date_utils.format(date, 'YYYY', this.state.options.language),
            'Quarter Day_upper':
                date.getDate() !== last_date.getDate()
                    ? date_utils.format(date, 'D MMM', this.state.options.language)
                    : '',
            'Half Day_upper':
                date.getDate() !== last_date.getDate()
                    ? date.getMonth() !== last_date.getMonth()
                        ? date_utils.format(
                              date,
                              'D MMM',
                              this.state.options.language
                          )
                        : date_utils.format(date, 'D', this.state.options.language)
                    : '',
            Day_upper:
                date.getMonth() !== last_date.getMonth()
                    ? date_utils.format(date, 'MMMM', this.state.options.language)
                    : '',
            Week_upper:
                date.getMonth() !== last_date.getMonth()
                    ? date_utils.format(date, 'MMMM', this.state.options.language)
                    : '',
            Month_upper:
                date.getFullYear() !== last_date.getFullYear()
                    ? date_utils.format(date, 'YYYY', this.state.options.language)
                    : '',
            Year_upper:
                date.getFullYear() !== last_date.getFullYear()
                    ? date_utils.format(date, 'YYYY', this.state.options.language)
                    : '',
        };

        /**調整前の基準となる座標 */
        const base_pos = {
            x: i * this.state.options.column_width,
            lower_y: this.state.options.header_height,
            upper_y: this.state.options.header_height - 25,
        };

        /**x座標調整用 */
        const x_pos = {
            'Quarter Day_lower': (this.state.options.column_width * 4) / 2,
            'Quarter Day_upper': 0,
            'Half Day_lower': (this.state.options.column_width * 2) / 2,
            'Half Day_upper': 0,
            Day_lower: this.state.options.column_width / 2,
            Day_upper: (this.state.options.column_width * 30) / 2,
            Week_lower: 0,
            Week_upper: (this.state.options.column_width * 4) / 2,
            Month_lower: this.state.options.column_width / 2,
            Month_upper: (this.state.options.column_width * 12) / 2,
            Year_lower: this.state.options.column_width / 2,
            Year_upper: (this.state.options.column_width * 30) / 2,
        };

        return {
            upper_text: date_text[`${this.state.options.view_mode}_upper`],
            lower_text: date_text[`${this.state.options.view_mode}_lower`],
            upper_x: base_pos.x + x_pos[`${this.state.options.view_mode}_upper`],
            upper_y: base_pos.upper_y,
            lower_x: base_pos.x + x_pos[`${this.state.options.view_mode}_lower`],
            lower_y: base_pos.lower_y,
        };
    }

    /**
     * barを生成する
     */
    make_bars() {
        //すべてのタスクについてbarを生成する
        this.state.bars = this.state.tasks.map((task) => {
            //生成したbarのラッパー(groupオブジェクト)をbarレイヤーに加える
            //この実装ではbar自体の座標などはbarクラス内で行う
            const bar = new Bar(
                this, // gantt obj
                task  // target task
            );
            this.state.layers.bar.appendChild(bar.group);
            //bar自体はstateで管理する
            return bar;
        });
    }

    /**
     * arrowを生成する
     */
    make_arrows() {
        this.state.arrows = [];
        //すべてのタスクについてarrowを生成する
        for (let task of this.state.tasks) {
            let arrows = [];
            //タスクに紐づけられたすべての依存タスクについてarrowを生成する
            arrows = task.dependencies
                .map((task_id) => {
                    /**依存関係にあるタスク */
                    const dependency = this.get_task(task_id);
                    if (!dependency) return;
                    const arrow = new Arrow(
                        this, // gantt obj
                        this.state.bars[dependency._index], // from_task
                        this.state.bars[task._index] // to_task
                    );
                    //arrowの実体（pathオブジェクト）をarrowレイヤーに追加する
                    this.state.layers.arrow.appendChild(arrow.element);
                    return arrow;
                })
                .filter(Boolean); // filter falsy values
            //stateに追加
            this.state.arrows = this.state.arrows.concat(arrows);
        }
    }

    /**
     * 関連するarrowをbarに結び付ける
     */
    map_arrows_on_bars() {
        //barの管轄のtaskがarrowのfromかtoになっている場合、barのarrows変数に追加する
        for (let bar of this.state.bars) {
            bar.arrows = this.state.arrows.filter((arrow) => {
                return (
                    arrow.from_task.task.id === bar.task.id ||
                    arrow.to_task.task.id === bar.task.id
                );
            });
        }
    }

    /**
     * 事前に設定したSVGの幅をsvgオブジェクト生成後の幅に合うように調整する
     */
    set_width() {
        /**今のSVG幅 */
        const cur_width = this.state.$svg.getBoundingClientRect().width;
        /**実際のSVG幅（グリッドの行の横幅） */
        const actual_width = this.state.$svg
            .querySelector('.grid .grid-row')
            .getAttribute('width');
        //グリッドの行の横幅のほうが大きい場合はそれに合わせる
        if (cur_width < actual_width) {
            this.state.$svg.setAttribute('width', actual_width);
        }
    }

    /**
     * 開始日時の一番早いタスクにスクロールを合わせる
     */
    set_scroll_position() {
        /**gantt-container */
        const parent_element = this.state.$svg.parentElement;
        if (!parent_element) return;

        /**開始日時の一番早いタスクとganttの開始日時の差分[h] */
        const hours_before_first_task = date_utils.diff(
            this.get_oldest_starting_date_of_tasks(),
            this.state.gantt_start,
            'hour'
        );

        /**左スクロール量 = (差分のマス数-1)*1マスの幅 */
        const scroll_pos =
            (hours_before_first_task / this.state.options.step) *
                this.state.options.column_width -
            this.state.options.column_width;

        parent_element.scrollLeft = scroll_pos;
    }

    bind_grid_click() {
        $.on(
            this.state.$svg,
            this.state.options.popup_trigger,
            '.grid-row, .grid-header',
            () => {
                this.unselect_all();
                this.hide_popup();
            }
        );
    }

    /**
     * barのイベントを登録する
     */
    bind_bar_events() {
        /**ドラッグ中かどうかのフラグ */
        let is_dragging = false;
        /**ドラッグが始まったx座標 */
        let x_on_start = 0;
        /**ドラッグが始まったy座標 */
        let y_on_start = 0;
        /**左にリサイズ中かどうかのフラグ */
        let is_resizing_left = false;
        /**右にリサイズ中かどうかのフラグ */
        let is_resizing_right = false;
        /**ドラッグ中のbarのwrapperのID */
        let parent_bar_id = null;
        /**イベントに関連するすべてのbar */
        let bars = [];
        /**ドラッグ中のbar wrapperのID(BarObj内参照用) */
        this.state.bar_id_being_dragged = null;

        function is_action_in_progress() {
            return is_dragging || is_resizing_left || is_resizing_right;
        }
        function is_this_bar_at_the_head(bar: Bar) {
            return parent_bar_id === bar.task.id
        }

        /**bar-wrapperクラスとhandleクラスにmousedownイベントを登録 */
        $.on(this.state.$svg, 'mousedown', '.bar-wrapper, .handle', (e, element) => {
            const bar_wrapper = $.closest('.bar-wrapper', element);

            //wrapperの所属クラスによってアクションを判別する
            if (element.classList.contains('left')) {
                is_resizing_left = true;
            } else if (element.classList.contains('right')) {
                is_resizing_right = true;
            } else if (element.classList.contains('bar-wrapper')) {
                is_dragging = true;
            }

            //wrapperにactiveクラスを追加する
            bar_wrapper.classList.add('active');

            //ドラッグのスタート地点を今のクリック位置に設定
            x_on_start = e.offsetX;
            y_on_start = e.offsetY;

            //wrapperのIDを保存しておく
            parent_bar_id = bar_wrapper.getAttribute('data-id');
            //wrapperと依存関係のタスクを列挙する
            const ids = [
                parent_bar_id,
                ...this.get_all_dependent_tasks(parent_bar_id),
            ];
            bars = ids.map((id) => this.get_bar(id));

            this.state.bar_id_being_dragged = parent_bar_id;

            //依存関係にあるすべてのbarに対してイベント用変数を初期化する
            bars.forEach((bar) => {
                /**barのrectオブジェクト */
                const $bar = bar.$bar;
                /**bar側の一時変数にbarのrectオブジェクトの初期値（x,y,width）を保存しておく */
                $bar.ox = $bar.getX();
                $bar.oy = $bar.getY();
                $bar.owidth = $bar.getWidth();
                /**barの移動量の初期値は０にしておく */
                $bar.finaldx = 0;
            });
        });

        $.on(this.state.$svg, 'mousemove', (e) => {
            if (!is_action_in_progress()) return;
            /**ドラッグスタートからのx座標の移動量 */
            const dx = e.offsetX - x_on_start;
            /**ドラッグスタートからのy座標の移動量 */
            const dy = e.offsetY - y_on_start;

            bars.forEach((bar) => {
                const $bar = bar.$bar;
                //現在の移動量からスナップする相対x座標を計算
                $bar.finaldx = this.get_relative_snap_position_x(dx);
                this.hide_popup();
                //
                if (is_resizing_left) {
                    //
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
                    //
                    if (is_this_bar_at_the_head(bar)) {
                        bar.update_bar_position({
                            width: $bar.owidth + $bar.finaldx,
                        });
                    }
                } else if (is_dragging) {
                    //barのx座標を「ドラッグ時初期値＋移動量(snap)」に更新する
                    bar.update_bar_position({ x: $bar.ox + $bar.finaldx });
                }
            });
        });

        /**
         * body内全域でマウスが離されたとき、ドラッグ系のフラグをすべて解除する
         */
        document.addEventListener('mouseup', (e) => {
            //移動中フラグが立っている場合、関連するすべてのbarのactiveクラスを解除する
            if (is_dragging || is_resizing_left || is_resizing_right) {
                bars.forEach((bar) => bar.group.classList.remove('active'));
            }

            is_dragging = false;
            is_resizing_left = false;
            is_resizing_right = false;
        });

        /**
         * SVG内でマウスが離されたとき、barの日付情報を更新する。
         */
        $.on(this.state.$svg, 'mouseup', (e) => {
            this.state.bar_id_being_dragged = null;
            bars.forEach((bar) => {
                const $bar = bar.$bar;
                if (!$bar.finaldx) return;
                bar.date_changed();
                bar.set_action_completed();
            });
        });

        this.bind_bar_progress();
    }

    /**
     * barのprogressバーのイベントを登録する
     */
    bind_bar_progress() {
        let x_on_start = 0;
        let y_on_start = 0;
        let is_resizing = null;
        let bar = null;
        let $bar_progress = null;
        let $bar = null;

        $.on(this.state.$svg, 'mousedown', '.handle.progress', (e, handle) => {
            is_resizing = true;
            x_on_start = e.offsetX;
            y_on_start = e.offsetY;

            const $bar_wrapper = $.closest('.bar-wrapper', handle);
            const id = $bar_wrapper.getAttribute('data-id');
            bar = this.get_bar(id);

            $bar_progress = bar.$bar_progress;
            $bar = bar.$bar;

            $bar_progress.finaldx = 0;
            $bar_progress.owidth = $bar_progress.getWidth();
            $bar_progress.min_dx = -$bar_progress.getWidth();
            $bar_progress.max_dx = $bar.getWidth() - $bar_progress.getWidth();
        });

        $.on(this.state.$svg, 'mousemove', (e) => {
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

        $.on(this.state.$svg, 'mouseup', () => {
            is_resizing = false;
            //$bar_progressのイベントでない場合は終了
            if (!($bar_progress && $bar_progress.finaldx)) return;
            //progressの日付を更新
            bar.progress_changed();
            bar.set_action_completed();
        });
    }

    get_all_dependent_tasks(task_id) {
        let out = [];
        let to_process = [task_id];
        while (to_process.length) {
            const deps = to_process.reduce((acc, curr) => {
                acc = acc.concat(this.state.dependency_map[curr]);
                return acc;
            }, []);

            out = out.concat(deps);
            to_process = deps.filter((d) => !to_process.includes(d));
        }

        return out.filter(Boolean);
    }

    /**
     * マウス移動がどこの位置にホールド（スナップ）されるか計算する。
     * 相対的で離散位置なことに注意。
     * @param dx 
     * @returns 
     */
    get_relative_snap_position_x(dx) {
        /**現在x座標 */
        let odx = dx
        /**ブロック幅で区切った時の端数 */
        let rem
        /**スナップ位置のx座標 */
        let rel_snap_position_x

        let days_per_block = 1

        if (this.view_is(VIEW_MODE.WEEK)) {
            rem = dx % (this.state.options.column_width / 7);
            rel_snap_position_x =
                odx -
                rem +
                (rem < this.state.options.column_width / 14
                    ? 0
                    : this.state.options.column_width / 7);
        } else if (this.view_is(VIEW_MODE.MONTH)) {
            rem = dx % (this.state.options.column_width / 30);
            rel_snap_position_x =
                odx -
                rem +
                (rem < this.state.options.column_width / 60
                    ? 0
                    : this.state.options.column_width / 30);
        } else {
            //ブロック幅で区切った時の端数を計算
            rem = dx % this.state.options.column_width;
            //端数がブロック幅の半分以上過ぎていたら次のブロックに移動したとみなしてx座標のスナップ位置を計算する
            rel_snap_position_x =
                odx - rem
                + (rem < this.state.options.column_width / 2
                    ? 0
                    : this.state.options.column_width);
        }
        return rel_snap_position_x;
    }

    unselect_all() {
        [...this.state.$svg.querySelectorAll('.bar-wrapper')].forEach((el) => {
            el.classList.remove('active');
        });
    }

    view_is(modes) {
        if (typeof modes === 'string') {
            return this.state.options.view_mode === modes;
        }

        if (Array.isArray(modes)) {
            return modes.some((mode) => this.state.options.view_mode === mode);
        }

        return false;
    }

    /**
     * stateのタスクからタスクIDに一致するタスクを抽出する
     * @param id - タスクID
     * @returns タスク
     */
    get_task(id) {
        return this.state.tasks.find((task) => {
            return task.id === id;
        });
    }

    /**
     * stateに登録されているbarからidに一致するものを返す
     * @param id 
     * @returns bar
     */
    get_bar(id) {
        return this.state.bars.find((bar) => {
            return bar.task.id === id;
        });
    }

    /**
     * popupを生成し表示する
     * @param options - 表示の際のオプション{target_element,title,subtitle,task}など
     */
    show_popup(options) {
        if (!this.state.popup) {
            this.state.popup = new Popup(
                this.state.popup_wrapper,
                this.state.options.custom_popup_html
            );
        }
        this.state.popup.show(options);
    }

    hide_popup() {
        this.state.popup && this.state.popup.hide();
    }

    trigger_event(event, args) {
        if (this.state.options['on_' + event]) {
            this.state.options['on_' + event].apply(null, args);
        }
    }

    /**
     * Gets the oldest starting date from the list of tasks
     *
     * @returns Date
     * @memberof Gantt
     */
    get_oldest_starting_date_of_tasks() {
        return this.state.tasks
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
    clear() {
        this.state.$svg.innerHTML = '';
    }

    render() {
        return (
            <div id="test" />
        )
    }
}

Gantt.VIEW_MODE = VIEW_MODE;

function generate_id(task) {
    return task.name + '_' + Math.random().toString(36).slice(2, 12);
}
