

export function createElement(tag, attrs) {
    const elem = document.createElement(tag);
    for (let attr in attrs) {
        if (attr === 'append_to') {
            const parent = attrs.append_to;
            parent.appendChild(elem);
        } else if (attr.startsWith('on')) {
            const eventName = attr.slice(2)
            elem.addEventListener(eventName, attrs[attr])
        } else if (attr === 'innerHTML') {
            elem.innerHTML = attrs.innerHTML;
        } else {
            elem.setAttribute(attr, attrs[attr]);
        }
    }
    return elem;
}

