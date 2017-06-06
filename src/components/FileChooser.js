import React from 'react'
import PropTypes from 'prop-types'

/*
使用方式：
- 在页面中渲染此 component，并指定一个 ref，和一个 onChoosed 回调。
- 在需要选择文件时，通过 ref 取得此 component，并调用此 component 的 choose() 方法。
- 选择完成后，会调用 onChoosed 回调，把用户选择的文件对象传给它。
  如果用户在文件对话框里点击取消，则这个回调不会被触发。

一个页面里有多个地方都要进行文件上传时，并不需要为每个地方分别部署一个 FileChooser，可以让它们共用一个 FileChooser。
只要在调用 FileChooser.choose() 时，针对不同的地方传入不同的 target 即可在文件选择完毕后确定这个文件是要被用在哪个地方。

应在一个 onClick 事件的回调内调用 this.refobj.choose(xxx)，不然可能无法成功打开文件对话框。
*/
export class FileChooser extends React.Component {
    static propTypes = {
        onChoosed: PropTypes.func.isRequired,       // onChoosed(fileObject, target)
    }

    chooseTarget = null

    choose = forTarget => {
        this.chooseTarget = forTarget
        this.fileInput.click()
    }

    onChange = () => {
        const file = this.fileInput.files[0]
        this.props.onChoosed(file, this.chooseTarget)
    }

    render() {
        return <input type="file" value="" style={{display: 'none'}}
            ref={r => this.fileInput = r} onChange={this.onChange} />
    }
}
