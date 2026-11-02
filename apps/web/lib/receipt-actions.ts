import {Children,Fragment,isValidElement,type ReactNode} from 'react';
/** Keep an original row's correction controls bound to its full permanent ID. */
export function receiptActionCells(body:ReactNode) {
 const actions=new Map<string,ReactNode>();
 function visit(children:ReactNode){Children.forEach(children,node=>{if(!isValidElement<{children:ReactNode}>(node))return;if(node.type===Fragment){visit(node.props.children);return;}if(node.type!=='tr'||node.key===null)return;const cells=Children.toArray(node.props.children).filter(n=>isValidElement(n)&&n.type==='td'),last=cells.at(-1);if(isValidElement<{children:ReactNode}>(last))actions.set(String(node.key),last.props.children);});}visit(body);return actions;
}
