import React, { useState, useEffect } from 'react';
import {createElement} from '../utils/element';
import {createSVG} from '../utils/svg';
import FrappeGantt from '../frappe_gantt/index'


const GanttRoot = () => {
    const n_test = 200
    const n_col = 3+3+6+3;

    const n_date = 30*12
    const date_width = 25

    const input_height = 25
    const input_width = 100

    
    const test_tasks = [...Array(n_test).keys()].map((i) => {
        return {
            id: `sample${i}`,
            name: `sample${i}あ`,
            start: '',
            end: '',
            progress: 0,
            dummy: 'DUMMY!',
        }
    })
    const [tasks, setTasks] = useState(test_tasks)

    const showEditor = (ref) => {
        console.debug(ref)
        const target = ref.target
        const index = target.dataset.index
        const x = target.attributes.x.nodeValue
        const y = target.attributes.y.nodeValue
        const rect = target.getBoundingClientRect()
        const height = rect.height//target.clientHeight
        const width = rect.width
        const text_memory = target.textContent
        const fill_memory = target.style.fill

        console.debug(ref.target.parentNode.getBoundingClientRect())
        console.debug(rect)

        const editorWrapperId = `editorWrapper-${index}`
        const editorWrapper = createSVG('foreignObject', {
            x: x,
            y: y,// - height, //text属性の座標設定は右下のため補正をかける
            width,
            height,
            id: editorWrapperId,
        })

        const editor = createElement('div', {
            append_to: editorWrapper,
            contentEditable: true,
            innerHTML: text_memory,
            class: 'mygtt-gantt-editable',
            onfocus: () => {
                console.debug('onfocus', editorWrapperId) //debug
            },
            onblur: (e:any) => {
                const text = e.target.textContent
                console.debug('onblur', editorWrapperId, text)
                if (text !== text_memory) {
                    let tasks_copy = [...tasks]
                    tasks_copy[index].name = text
                    setTasks(tasks_copy)
                }
                document.getElementById(editorWrapperId)?.remove()
                target.style.fill = fill_memory
            },
        })
        editor.style.color = 'red' //debug

        target.style.fill = 'none'
        //foreignObject.appendChild(editor)
        target.parentNode.prepend(editorWrapper)
        editor.focus()
    }

    let gantt

    const Debug = ({tasks}:any) => {
        return (
            <div>
                {tasks[0].name}
            </div>
        )
    }

    useEffect(() => {
        const wrapper = document.getElementById('gantt-body')
        
        /*
        gantt = new frappeGantt({wrapper, tasks, options:{
            on_click: task => {
                console.log(task);
            },
            on_date_change: (task, start, end) => {
                console.log(task, start, end);
            },
            on_progress_change: (task, progress) => {
                console.log(task, progress);
            },
            on_view_change: (mode) => {
                console.log(mode);
            },
            view_mode: 'Day',
            language: 'ja'
        }})
        console.log('gantt.tsx:useEffect:gantt', gantt)
        */
        
    }, [])

    const SvgElem = ({x1,y1,x2,y2,className}:any) => {
        return (
            <line x1={x1} y1={y1} x2={x2} y2={y2} className={className}></line>
        )
    }

    return (
        <>
        <div className="mygtt">
            <div className="mygtt-control">control<Debug tasks={tasks} /></div>
            <div className="mygtt-body">
                <div className="mygtt-header">
                    <div className="mygtt-header-tasks">mygtt-header-tasks</div>
                    <div className="mygtt-header-gantt">mygtt-header-gantt</div>
                </div>
                <div className="mygtt-contents">
                    <div id="mygtt-contents-gantt" className="mygtt-contents-gantt">
                    <div className="mygtt-contents-tasks">

                        <svg id="mygtt-contents-tasks-svg" className="mygtt-svg" height={n_test*input_height} width="auto">
                            {[...Array(n_col).keys()].map((j) => 
                                <g id={`g-${j}`} width={input_width}>
                                    {tasks.map((t, i) => 
                                        <text
                                            key={`gantt-${i}-${j}`} id={`gantt-${i}-${j}`} data-index={i}
                                            x={j*input_width} y={i*input_height} width={input_width} height={input_height}
                                            className="mygtt-gantt-editable"
                                            onClick={showEditor}
                                        >
                                            {t.name}
                                        </text>
                                    )}
                                </g>
                            )}
                            <g id="row_line">
                                {[...Array(n_test).keys()].map((y) =>
                                    <line x1="0" y1={y*input_height} x2={n_col*input_width} y2={y*input_height} className='mygtt-gantt-line'></line>
                                )}
                            </g>
                            <g id="col_line">
                                {[...Array(n_col).keys()].map((x) =>
                                    <SvgElem x1={x*input_width} y1="0" x2={x*input_width} y2={n_col*input_height} className='mygtt-gantt-line'></SvgElem>
                                )}
                            </g>
                            <rect id="debug" className="test" x="0" y="0" width="100" height="50" fill="purple" />
                        </svg>

                    </div>
                    </div>
                </div>
            </div>

        </div>

        <div style={{height:"200px"}} ></div>
        <div id="gantt-test">
            <div className="contents-area">
                <div className="contents-header">contents-header</div>
                <div className="contents-body">
                        <svg id="mygtt-contents-tasks-svg" className="mygtt-svg" height={n_test*input_height} width="auto">
                            {[...Array(n_col).keys()].map((j) => 
                                <g id={`g-${j}`} width={input_width}>
                                    {tasks.map((t, i) => 
                                        <text
                                            key={`gantt-${i}-${j}`} id={`gantt-${i}-${j}`} data-index={i}
                                            x={j*input_width} y={i*input_height} width={input_width} height={input_height}
                                            className="mygtt-gantt-editable"
                                            onClick={showEditor}
                                        >
                                            {t.name}
                                        </text>
                                    )}
                                </g>
                            )}
                            <g id="row_line">
                                {[...Array(n_test).keys()].map((y) =>
                                    <line x1="0" y1={y*input_height} x2={n_col*input_width} y2={y*input_height} className='mygtt-gantt-line'></line>
                                )}
                            </g>
                            <g id="col_line">
                                {[...Array(n_col).keys()].map((x) =>
                                    <SvgElem x1={x*input_width} y1="0" x2={x*input_width} y2={n_col*input_height} className='mygtt-gantt-line'></SvgElem>
                                )}
                            </g>
                            <rect id="debug" className="test" x="0" y="0" width="100" height="50" fill="purple" />
                        </svg></div>
            </div>
            <div className="gantt-area">
                <div className="gantt-header" id="gantt-header">gantt-header</div>
                <div className="gantt-body" id="gantt-body">
                    <FrappeGantt
                        wrapper="#gantt-body"
                        wrapper_header="#gantt-header"
                        tasks={tasks}
                        options={{}}
                    />
                </div>
            </div>
        </div>
        <div style={{height:"200px"}} ></div>
        </>
    )
}

export default GanttRoot
