function drawBackground(ctx) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.fillStyle = 'lime'

    // north
    canvas_arrow(ctx, ctx.canvas.width/2, ctx.canvas.height/2, ctx.canvas.width/2, 20)
    ctx.fillText('270', ctx.canvas.width/2-8, 12)
    
    // south
    canvas_arrow(ctx, ctx.canvas.width/2, ctx.canvas.height/2, ctx.canvas.width/2, ctx.canvas.height-20)
    ctx.fillText('90', ctx.canvas.width/2-6, ctx.canvas.height-4)

    // west
    canvas_arrow(ctx, ctx.canvas.width/2, ctx.canvas.height/2, 20, ctx.canvas.height/2)
    ctx.fillText('180', 2, ctx.canvas.height/2+3)

    // east
    canvas_arrow(ctx, ctx.canvas.width/2, ctx.canvas.height/2, ctx.canvas.width-20, ctx.canvas.height/2)
    ctx.fillText('0', ctx.canvas.width-8, ctx.canvas.height/2+3)

    ctx.strokeStyle = "black"
    ctx.stroke()

    // axes
    canvas_arrow(ctx, 1, 1, 1, ctx.canvas.height-1) // Y
    canvas_arrow(ctx, 1, 1, ctx.canvas.width-1, 1) // X
    
    ctx.strokeStyle = "lime"
    ctx.stroke()
}

function drawRadar(ctx, botstate, ratio, x, y) {
    var radar_radius = radarRadius * ratio

    var angle1 = botstate.radarDirection-botstate.radarSweep
    var angle2 = botstate.radarDirection

    if(angle1 > angle2) {
        var from_angle = angle1
        var to_angle = angle2
    }
    else {
        var from_angle = angle2
        var to_angle = angle1
    }

    // from
    var linetoX1 = radar_radius * Math.cos((from_angle) * oneDegree) + x
    var linetoY1 = radar_radius * Math.sin((from_angle) * oneDegree) + y

    // to
    var linetoX2 = radar_radius * Math.cos((to_angle) * oneDegree) + x
    var linetoY2 = radar_radius * Math.sin((to_angle) * oneDegree) + y

    // drawing
    ctx.beginPath()    
    ctx.moveTo(linetoX1, linetoY1)
    ctx.lineTo(x, y)
    ctx.lineTo(linetoX2, linetoY2)

    // style
    // ctx.setLineDash([5,4])
    ctx.strokeStyle = botstate.scanColor ? botstate.scanColor : 'white'

    // draw!
    ctx.stroke()
}

function drawHittingCircle(ctx, botstate, ratio, x, y) {
    var hittingCircle_radius = 18 * ratio
    ctx.beginPath()
    ctx.arc(x, y, hittingCircle_radius, 0, 2 * Math.PI, false)
    ctx.fillStyle = botstate.bodyColor ? botstate.bodyColor : 'white'
    ctx.fill()
}

function drawGun(ctx, botstate, ratio, x, y) {
    var angle = botstate.gunDirection
    var linetoX = gun_radius * ratio * Math.cos((angle) * oneDegree) + x
    var linetoY = gun_radius * ratio * Math.sin((angle) * oneDegree) + y

    // drawing
    ctx.moveTo(x, y)
    ctx.lineTo(linetoX, linetoY)

    // style
    // ctx.setLineDash([])
    ctx.strokeStyle = botstate.gunColor ? botstate.gunColor : 'white'
    
    // draw!
    ctx.stroke()
}

function drawDirection(ctx, botstate, x, y) {
    ctx.moveTo(x, y)
    var angle = botstate.direction
    var linetoX = 30 * Math.cos((angle) * oneDegree) + x
    var linetoY = 30 * Math.sin((angle) * oneDegree) + y
    ctx.setLineDash([])
    ctx.strokeStyle = botstate.bodyColor ? botstate.bodyColor : 'white'
    canvas_arrow(ctx, x, y, linetoX, linetoY)
    ctx.stroke()
}

function drawBullet(ctx, bulletState, ratio) {
    var x = bulletState.x * ratio
    var y = bulletState.y * ratio

    var radius = 1+bulletState.power
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, 2 * Math.PI, false)
    ctx.fillStyle = bulletState.color ? bulletState.color : 'white'
    ctx.fill()
}

function drawId(ctx, botState, x, y) {
    ctx.fillStyle = botState.bodyColor ? 'white' : 'black'
    ctx.font = "15px Arial";
    ctx.fillText(botState.id, x-4, y+5)
}

function canvas_arrow(context, fromx, fromy, tox, toy) {
    var headlen = 10; // length of head in pixels
    var dx = tox - fromx;
    var dy = toy - fromy;
    var angle = Math.atan2(dy, dx);
    context.moveTo(fromx, fromy);
    context.lineTo(tox, toy);
    context.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
    context.moveTo(tox, toy);
    context.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
}