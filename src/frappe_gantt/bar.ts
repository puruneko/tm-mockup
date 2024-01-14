import date_utils from './date_utils';
import { $, createSVG, animateSVG } from './svg_utils';

export default class Bar {
    constructor(gantt, task) {
        this.set_defaults(gantt, task);
        this.prepare();
        this.draw();
        this.bind();
    }

    set_defaults(gantt, task) {
        this.action_completed = false;
        this.gantt = gantt;
        this.task = task;
    }

    prepare() {
        this.prepare_values();
        this.prepare_helpers();
    }

    prepare_values() {
        console.log('Bar.ts >>> prepare_values', this.gantt)
        this.invalid = this.task.invalid;
        this.height = this.gantt.state.options.bar_height;
        this.x = this.compute_x();
        this.y = this.compute_y();
        this.corner_radius = this.gantt.state.options.bar_corner_radius;
        /**タスクの幅のブロック数 */
        this.duration =
            date_utils.diff(this.task._end, this.task._start, 'hour') /
            this.gantt.state.options.step;
        this.width = this.gantt.state.options.column_width * this.duration;
        this.progress_width =
            this.gantt.state.options.column_width *
                this.duration *
                (this.task.progress / 100) || 0;
        /**barのwrapper（g要素） */
        this.group = createSVG('g', {
            class: 'bar-wrapper ' + (this.task.custom_class || ''),
            'data-id': this.task.id,
        });
        /**barの表示要素のwrapper（g要素、group配下） */
        this.bar_group = createSVG('g', {
            class: 'bar-group',
            append_to: this.group,
        });
        /**barのハンドル要素のwrapper（g要素、group配下） */
        this.handle_group = createSVG('g', {
            class: 'handle-group',
            append_to: this.group,
        });
        console.log('Bar.ts <<< prepare_values')
    }

    prepare_helpers() {
        SVGElement.prototype.getX = function () {
            return +this.getAttribute('x');
        };
        SVGElement.prototype.getY = function () {
            return +this.getAttribute('y');
        };
        SVGElement.prototype.getWidth = function () {
            return +this.getAttribute('width');
        };
        SVGElement.prototype.getHeight = function () {
            return +this.getAttribute('height');
        };
        SVGElement.prototype.getEndX = function () {
            return this.getX() + this.getWidth();
        };
    }

    draw() {
        this.draw_bar();
        this.draw_progress_bar();
        this.draw_label();
        this.draw_resize_handles();
    }

    /**
     * barをrectで描画する。このbarはbar_groupに属する。
     */
    draw_bar() {
        this.$bar = createSVG('rect', {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            rx: this.corner_radius,
            ry: this.corner_radius,
            class: 'bar',
            append_to: this.bar_group,
        });

        animateSVG(this.$bar, 'width', 0, this.width);

        //invalidタスクの場合、クラスを追加しておく（cssで見えなくする）。
        if (this.invalid) {
            this.$bar.classList.add('bar-invalid');
        }
    }

    /**
     * progressバーをrectで描画する。bar_groupに属する。
     * @returns 
     */
    draw_progress_bar() {
        if (this.invalid) return;
        this.$bar_progress = createSVG('rect', {
            x: this.x,
            y: this.y,
            width: this.progress_width,
            height: this.height,
            rx: this.corner_radius,
            ry: this.corner_radius,
            class: 'bar-progress',
            append_to: this.bar_group,
        });

        animateSVG(this.$bar_progress, 'width', 0, this.progress_width);
    }

    /**
     * labelをtextで描画する。bar_groupに属する
     */
    draw_label() {
        createSVG('text', {
            x: this.x + this.width / 2,
            y: this.y + this.height / 2,
            innerHTML: this.task.name,
            class: 'bar-label',
            append_to: this.bar_group,
        });
        // labels get BBox in the next tick
        // ラベルを邪魔しないタイミングで配置する（処理が空いているフレームで実行）
        requestAnimationFrame(() => this.update_label_position());
    }

    /**
     * 左右の日付調整ハンドルとprogress変更ハンドルを描画する。handle_groupに属する。
     * 日付調整はrect、progressはpolygonで三角形。
     * @returns 
     */
    draw_resize_handles() {
        if (this.invalid) return;

        const bar = this.$bar;
        const handle_width = 8;

        createSVG('rect', {
            x: bar.getX() + bar.getWidth() - 9,
            y: bar.getY() + 1,
            width: handle_width,
            height: this.height - 2,
            rx: this.corner_radius,
            ry: this.corner_radius,
            class: 'handle right',
            append_to: this.handle_group,
        });

        createSVG('rect', {
            x: bar.getX() + 1,
            y: bar.getY() + 1,
            width: handle_width,
            height: this.height - 2,
            rx: this.corner_radius,
            ry: this.corner_radius,
            class: 'handle left',
            append_to: this.handle_group,
        });

        //progressが100%以下の場合はprogressバーを表示
        if (this.task.progress && this.task.progress < 100) {
            this.$handle_progress = createSVG('polygon', {
                points: this.get_progress_polygon_points().join(','),
                class: 'handle progress',
                append_to: this.handle_group,
            });
        }
    }

    /**
     * progress用の三角形のつまみの3点を計算する
     * @returns [x1,y1,x2,y2,x3,y3]
     */
    get_progress_polygon_points() {
        const bar_progress = this.$bar_progress;
        return [
            bar_progress.getEndX() - 5,
            bar_progress.getY() + bar_progress.getHeight(),
            bar_progress.getEndX() + 5,
            bar_progress.getY() + bar_progress.getHeight(),
            bar_progress.getEndX(),
            bar_progress.getY() + bar_progress.getHeight() - 8.66,
        ];
    }

    /**
     * taskがinvalid出なければクリックイベントを登録する 
     */
    bind() {
        if (this.invalid) return;
        this.setup_click_event();
    }

    setup_click_event() {
        /**
         * フォーカスが当たった時・またはpopupトリガーとして登録されているイベントが発火されたとき、popupを表示する
         */
        $.on(this.group, 'focus ' + this.gantt.state.options.popup_trigger, (e) => {
            //アクション終了直後の場合はイベントは発火させない
            if (this.action_completed) {
                // just finished a move action, wait for a few seconds
                return;
            }

            this.show_popup();
            this.gantt.unselect_all();
            this.group.classList.add('active');
        });

        $.on(this.group, 'dblclick', (e) => {
            //アクション終了直後の場合はイベントは発火させない
            if (this.action_completed) {
                // just finished a move action, wait for a few seconds
                return;
            }

            //optionsで登録されているclickイベントを発火する
            this.gantt.trigger_event('click', [this.task]);
        });
    }

    /**
     * taskに関するpopupを表示する
     */
    show_popup() {
        //ドラッグ中の場合はスキップ
        if (this.gantt.bar_id_being_dragged) return;

        const start_date_str = date_utils.format(
            this.task._start,
            'MMM D',
            this.gantt.state.options.language
        );
        const end_date_str = date_utils.format(
            date_utils.add(this.task._end, -1, 'second'),
            'MMM D',
            this.gantt.state.options.language
        );
        const subtitle = start_date_str + ' - ' + end_date_str;

        //popupの表示を依頼する
        this.gantt.show_popup({
            target_element: this.$bar,
            title: this.task.name,
            subtitle: subtitle,
            task: this.task,
        });
    }

    /**
     * barのx座標・幅を変更し付随情報（ラベルや矢印）の位置も変更する。
     * @param x - 移動後のx座標
     * @param width - 変更後の幅
     */
    update_bar_position({ x = null, width = null }) {
        const bar = this.$bar;
        if (x) {
            // get all x values of parent task
            const xs = this.task.dependencies.map((dep) => {
                return this.gantt.get_bar(dep).$bar.getX();
            });
            // child task must not go before parent
            const valid_x = xs.reduce((prev, curr) => {
                return x >= curr;
            }, x);
            if (!valid_x) {
                width = null;
                return;
            }
            this.update_attr(bar, 'x', x);
        }
        if (width && width >= this.gantt.state.options.column_width) {
            this.update_attr(bar, 'width', width);
        }
        this.update_label_position();
        this.update_handle_position();
        this.update_progressbar_position();
        this.update_arrow_position();
    }

    /**
     * barの位置からタスクの開始日・終了日を計算し更新する。
     * date_changeイベントも発火する。
     */
    date_changed() {
        let changed = false;
        const { new_start_date, new_end_date } = this.compute_start_end_date();

        //変更がある場合のみ情報を更新
        if (Number(this.task._start) !== Number(new_start_date)) {
            changed = true;
            this.task._start = new_start_date;
        }

        if (Number(this.task._end) !== Number(new_end_date)) {
            changed = true;
            this.task._end = new_end_date;
        }

        if (!changed) return;

        //変更があった場合のみ日付変更イベントを発火する
        this.gantt.trigger_event('date_change', [
            this.task,
            new_start_date,
            date_utils.add(new_end_date, -1, 'second'),
        ]);
    }

    /**
     * barの位置からタスクのprogressを計算し更新する。
     * progress_changeイベントも発火する。
     */
    progress_changed() {
        const new_progress = this.compute_progress();
        this.task.progress = new_progress;
        this.gantt.trigger_event('progress_change', [this.task, new_progress]);
    }

    /**
     * アクションが完了した直後にすぐ次のアクションが実行されないよう保護する。
     * action_completedフラグをＯＮにし、1秒後にOFFにする
     */
    set_action_completed() {
        this.action_completed = true;
        setTimeout(() => (this.action_completed = false), 1000);
    }

    /**
     * barの現在のpos情報からタスクの開始日時・終了日時を計算する
     * @returns { new_start_date, new_end_date }
     */
    compute_start_end_date() {
        const bar = this.$bar;
        /**ganttスタート日時からbarまでのマス数 */
        const x_in_units = bar.getX() / this.gantt.state.options.column_width;
        /**更新後のタスク開始日時 = ganttスタート日時 + barまでのマス数(=日数) * 1マスの時間(=24) ※dayモードの場合の例 */
        const new_start_date = date_utils.add(
            this.gantt.gantt_start,
            x_in_units * this.gantt.state.options.step,
            'hour'
        );
        /**タスク幅のマス数 */
        const width_in_units = bar.getWidth() / this.gantt.state.options.column_width;
        /**更新後のタスクの終了日時 = 更新後のタスクの開始日時 + タスク幅のマス数 * 1マスの時間(=24) ※dayモードの場合の例 */
        const new_end_date = date_utils.add(
            new_start_date,
            width_in_units * this.gantt.state.options.step,
            'hour'
        );

        return { new_start_date, new_end_date };
    }

    /**
     * barの幅からprogressを計算する
     * @returns percentage
     */
    compute_progress() {
        const progress =
            (this.$bar_progress.getWidth() / this.$bar.getWidth()) * 100;
        return parseInt(progress, 10);
    }

    /**
     * タスクのx座標を計算
     * @returns x座標
     */
    compute_x() {
        /**1マス当たりの時間[h] */
        const step = this.gantt.state.options.step
        /**1マス当たりの幅[px] */
        const column_width = this.gantt.state.options.column_width
        /**タスクのスタート日時 */
        const task_start = this.task._start;
        /**ganttの左端の日時 */
        const gantt_start = this.gantt.gantt_start;

        /**左端からタスク開始日時までの時間差[h] */
        const diff_hour = date_utils.diff(task_start, gantt_start, 'hour');
        /**barのx座標 */
        let x = (diff_hour / step) * column_width;

        //モードがMonthの場合、1マスが30日になるように調整
        if (this.gantt.view_is('Month')) {
            const diff_day = date_utils.diff(task_start, gantt_start, 'day');
            x = (diff_day * column_width) / 30;
        }
        return x;
    }

    /**
     * タスクのy座標を計算
     * @returns y座標
     */
    compute_y() {
        return (
            this.gantt.state.options.header_height +
            this.gantt.state.options.padding +
            this.task._index * (this.height + this.gantt.state.options.padding)
        );
    }

    /*
    get_relative_snap_position_x(dx) {
        let odx = dx,
            rem,
            position;

        if (this.gantt.view_is('Week')) {
            rem = dx % (this.gantt.state.options.column_width / 7);
            position =
                odx -
                rem +
                (rem < this.gantt.state.options.column_width / 14
                    ? 0
                    : this.gantt.state.options.column_width / 7);
        } else if (this.gantt.view_is('Month')) {
            rem = dx % (this.gantt.state.options.column_width / 30);
            position =
                odx -
                rem +
                (rem < this.gantt.state.options.column_width / 60
                    ? 0
                    : this.gantt.state.options.column_width / 30);
        } else {
            rem = dx % this.gantt.state.options.column_width;
            position =
                odx -
                rem +
                (rem < this.gantt.state.options.column_width / 2
                    ? 0
                    : this.gantt.state.options.column_width);
        }
        return position;
    }
    */

    /**
     * elementのパラメータを更新する
     * @param element - 要素
     * @param attr - パラメータ名
     * @param value - 値（数値に変換可能な値のみ有効）
     * @returns 更新されたelement
     */
    update_attr(element, attr, value) {
        value = +value;
        if (!isNaN(value)) {
            element.setAttribute(attr, value);
        }
        return element;
    }

    /**
     * 現在のtaskのprogressから$bar_progressの幅を更新する
     */
    update_progressbar_position() {
        if (this.invalid) return;
        this.$bar_progress.setAttribute('x', this.$bar.getX());
        this.$bar_progress.setAttribute(
            'width',
            this.$bar.getWidth() * (this.task.progress / 100)
        );
    }

    /**
     * label位置を現在のbarとlabelの状況に応じて更新する
     */
    update_label_position() {
        const bar = this.$bar
        const label = this.group.querySelector('.bar-label');

        //getBBoxで{x,y,width,height}を取得し、
        //barの幅をlabelが超過している場合は、labelをbarの右に外表示する（.bigをつけてCSSでも微調整）
        if (label.getBBox().width > bar.getWidth()) {
            label.classList.add('big');
            label.setAttribute('x', bar.getX() + bar.getWidth() + 5);
        } else {
            //barの幅に収まっている場合は、barの中央にx座標を持ってきてtext-anchorを中央揃えにする(CSSで)
            label.classList.remove('big');
            label.setAttribute('x', bar.getX() + bar.getWidth() / 2);
        }
    }

    /**
     * 現在のbarの位置に応じてhandleの位置を更新する
     */
    update_handle_position() {
        if (this.invalid) return;
        const bar = this.$bar;
        this.handle_group
            .querySelector('.handle.left')
            .setAttribute('x', bar.getX() + 1);
        this.handle_group
            .querySelector('.handle.right')
            .setAttribute('x', bar.getEndX() - 9);
        const handle = this.group.querySelector('.handle.progress');
        handle &&
            handle.setAttribute('points', this.get_progress_polygon_points());
    }

    /**
     * 関連のarrowsの更新を行う
     */
    update_arrow_position() {
        //この実装ではbarへのarrowsの関連付けはganttで行っている
        this.arrows = this.arrows || [];
        for (let arrow of this.arrows) {
            arrow.update();
        }
    }
}

function isFunction(functionToCheck) {
    var getType = {};
    return (
        functionToCheck &&
        getType.toString.call(functionToCheck) === '[object Function]'
    );
}
